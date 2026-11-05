ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS check_outcome text, ADD COLUMN IF NOT EXISTS check_limitations jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS route_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.approvals.check_outcome IS 'Deterministic check outcome at routing: completed | completed_with_warnings (reviews.status = partial).';

CREATE OR REPLACE FUNCTION public.approvals_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('markwise.content_purge', true) = 'on' THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Approval records are immutable'; END IF;
  IF OLD.status <> 'open' THEN RAISE EXCEPTION 'Approval decisions are final'; END IF;
  IF NEW.id <> OLD.id OR NEW.content_id <> OLD.content_id OR NEW.version_id <> OLD.version_id OR NEW.route <> OLD.route OR NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
     OR NEW.assigned_by <> OLD.assigned_by OR NEW.created_at <> OLD.created_at OR NEW.workspace_id <> OLD.workspace_id OR NEW.ai_state_at_routing <> OLD.ai_state_at_routing
     OR NEW.check_outcome IS DISTINCT FROM OLD.check_outcome OR NEW.check_limitations <> OLD.check_limitations OR NEW.route_reasons <> OLD.route_reasons THEN
    RAISE EXCEPTION 'Approval routing cannot change'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.record_review(_actor uuid, _content_id uuid, _content_version_id uuid, _findings jsonb, _dropped integer, _limitations jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _c public.contents; _v public.content_versions; _rid uuid; f jsonb; _n int := 0;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _actor OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _actor AND workspace_id = _c.workspace_id AND role = 'creator') THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status NOT IN ('submitted','checked') THEN RAISE EXCEPTION 'Checks run only on submitted content'; END IF;
  IF _c.status = 'checked' AND NOT EXISTS (SELECT 1 FROM public.reviews r JOIN public.content_versions v ON v.id = r.content_version_id WHERE r.content_id = _c.id AND v.version_number = _c.version AND r.source = 'deterministic') THEN RAISE EXCEPTION 'Checks run only on submitted content'; END IF;
  SELECT * INTO _v FROM public.content_versions WHERE id = _content_version_id AND content_id = _c.id;
  IF NOT FOUND OR _v.version_number <> _c.version THEN RAISE EXCEPTION 'Checks must use the exact submitted version'; END IF;
  IF EXISTS (SELECT 1 FROM public.reviews WHERE content_version_id = _v.id AND source = 'deterministic') THEN RAISE EXCEPTION 'Checks already ran for this version'; END IF;
  IF jsonb_typeof(_findings) <> 'array' OR jsonb_array_length(_findings) > 500 THEN RAISE EXCEPTION 'Invalid findings'; END IF;
  IF jsonb_typeof(coalesce(_limitations,'[]')) <> 'array' THEN RAISE EXCEPTION 'Invalid limitations'; END IF;
  INSERT INTO public.reviews (content_id, content_version_id, workspace_id, version_number, run_by, status, dropped_findings_count, finding_count, limitations, source)
  VALUES (_c.id, _v.id, _c.workspace_id, _v.version_number, _actor, CASE WHEN jsonb_array_length(coalesce(_limitations,'[]')) > 0 THEN 'partial' ELSE 'completed' END, greatest(coalesce(_dropped,0),0), jsonb_array_length(_findings), coalesce(_limitations,'[]'), 'deterministic')
  RETURNING id INTO _rid;
  FOR f IN SELECT * FROM jsonb_array_elements(_findings) LOOP
    IF f->>'cited_kind' = 'rule' AND NOT EXISTS (SELECT 1 FROM public.rules WHERE id = (f->>'cited_id')::uuid AND workspace_id = _c.workspace_id AND code = f->>'cited_code') THEN RAISE EXCEPTION 'Finding cites a rule outside this workspace'; END IF;
    IF f->>'cited_kind' = 'glossary' AND NOT EXISTS (SELECT 1 FROM public.glossary WHERE id = (f->>'cited_id')::uuid AND workspace_id = _c.workspace_id) THEN RAISE EXCEPTION 'Finding cites a glossary entry outside this workspace'; END IF;
    IF f->>'cited_kind' = 'palette' AND f->>'cited_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.palette WHERE id = (f->>'cited_id')::uuid AND workspace_id = _c.workspace_id) THEN RAISE EXCEPTION 'Finding cites a palette colour outside this workspace'; END IF;
    IF f->>'cited_kind' IN ('wcag','spec') AND f->>'cited_id' IS NOT NULL THEN RAISE EXCEPTION 'Invalid citation'; END IF;
    IF f->>'cited_kind' NOT IN ('rule','glossary','palette','wcag','spec') OR f->>'check_name' = 'ai_review' THEN RAISE EXCEPTION 'Invalid deterministic finding'; END IF;
    INSERT INTO public.findings (review_id, content_id, workspace_id, check_name, category, severity, confidence, span_start, span_end, quoted_text, explanation, cited_kind, cited_id, cited_code, cited_passage, outcome)
    VALUES (_rid, _c.id, _c.workspace_id, f->>'check_name', left(f->>'category',40), f->>'severity', (f->>'confidence')::numeric, (f->>'span_start')::int, (f->>'span_end')::int,
      left(coalesce(f->>'quoted_text',''),1000), left(f->>'explanation',2000), f->>'cited_kind', (f->>'cited_id')::uuid, left(coalesce(f->>'cited_code',''),60), left(coalesce(f->>'cited_passage',''),2000), f->>'outcome');
    _n := _n + 1;
  END LOOP;
  -- Phase 6 amendment: checks that finished (with or without warnings) move to checked; warnings force reviewer routing later.
  PERFORM set_config('markwise.content_transition', 'on', true);
  UPDATE public.contents SET status = 'checked' WHERE id = _c.id;
  PERFORM set_config('markwise.content_transition', 'off', true);
  PERFORM public.content_audit(_c.workspace_id, _actor, 'review_completed', _c.id, jsonb_build_object('version', _v.version_number, 'review_id', _rid, 'findings', _n, 'dropped', greatest(coalesce(_dropped,0),0), 'limitations', jsonb_array_length(coalesce(_limitations,'[]'))));
  RETURN _rid;
END $function$;

CREATE OR REPLACE FUNCTION public.approval_route_facts(_content_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.contents; _v public.content_versions; _blocking int; _ai text; _r public.reviews; _outcome text; _lim jsonb := '[]'::jsonb; _reasons jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL;
  IF NOT FOUND OR NOT public.can_read_content(_content_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  SELECT * INTO _v FROM public.content_versions WHERE content_id = _c.id AND version_number = _c.version;
  _ai := public.ai_state(_v.id);
  SELECT * INTO _r FROM public.reviews WHERE content_version_id = _v.id AND source = 'deterministic';
  IF NOT FOUND THEN _outcome := 'failed';
  ELSIF _r.status = 'completed' THEN _outcome := 'completed';
  ELSE _outcome := 'completed_with_warnings'; _lim := coalesce(_r.limitations, '[]'::jsonb); END IF;
  SELECT count(*) INTO _blocking FROM public.findings f JOIN public.reviews r ON r.id = f.review_id
    WHERE r.content_version_id = _v.id AND f.severity IN ('high','critical') AND f.outcome <> 'supported'
      AND NOT EXISTS (SELECT 1 FROM public.finding_actions a WHERE a.finding_id = f.id);
  IF EXISTS (SELECT 1 FROM public.findings f JOIN public.reviews r ON r.id = f.review_id WHERE r.content_version_id = _v.id AND f.category IN ('claim','legal')) THEN
    _reasons := _reasons || '["A finding concerns a claim or legal matter"]'::jsonb; END IF;
  IF EXISTS (SELECT 1 FROM public.findings f JOIN public.reviews r ON r.id = f.review_id WHERE r.content_version_id = _v.id AND f.outcome = 'cannot_verify') THEN
    _reasons := _reasons || '["A finding needs checking against approved sources"]'::jsonb; END IF;
  IF _outcome = 'completed_with_warnings' THEN
    _reasons := _reasons || '["Some automatic checks could not produce a result"]'::jsonb; END IF;
  RETURN jsonb_build_object('version', _c.version, 'version_id', _v.id, 'status', _c.status, 'ai_state', _ai, 'blocking', _blocking,
    'check_outcome', _outcome, 'limitations', _lim, 'reasons', _reasons,
    'route', CASE WHEN jsonb_array_length(_reasons) > 0 THEN 'reviewer' ELSE 'manager' END);
END $$;
REVOKE ALL ON FUNCTION public.approval_route_facts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approval_route_facts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_for_approval(_content_id uuid, _expected_version integer, _reviewer_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _uid uuid := auth.uid(); _c public.contents; _facts jsonb; _route text; _rev uuid; _aid uuid;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _uid OR NOT public.has_role(_uid, 'creator', _c.workspace_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'checked' THEN RAISE EXCEPTION 'Only checked content can be sent for approval'; END IF;
  IF _c.version <> _expected_version THEN RAISE EXCEPTION 'This content changed since you opened it; reload and try again'; END IF;
  _facts := public.approval_route_facts(_content_id);
  IF _facts->>'check_outcome' NOT IN ('completed','completed_with_warnings') THEN RAISE EXCEPTION 'The automatic checks have not finished for this version; run them again'; END IF;
  IF _facts->>'ai_state' = 'pending' THEN RAISE EXCEPTION 'The AI review has not finished for this version; wait for it or run it again'; END IF;
  IF (_facts->>'blocking')::int > 0 THEN RAISE EXCEPTION 'Resolve all high and critical findings before sending for approval'; END IF;
  _route := _facts->>'route';
  IF _route = 'reviewer' THEN
    IF _reviewer_id IS NULL THEN RAISE EXCEPTION 'This content needs a named reviewer'; END IF;
    IF _reviewer_id = _uid OR NOT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.workspace_members wm ON wm.user_id = ur.user_id AND wm.workspace_id = ur.workspace_id WHERE ur.user_id = _reviewer_id AND ur.workspace_id = _c.workspace_id AND ur.role = 'reviewer') THEN RAISE EXCEPTION 'Choose a reviewer from this workspace'; END IF;
    _rev := _reviewer_id;
  END IF;
  INSERT INTO public.approvals (workspace_id, content_id, version_id, version_number, route, reviewer_id, assigned_by, ai_state_at_routing, check_outcome, check_limitations, route_reasons)
    VALUES (_c.workspace_id, _c.id, (_facts->>'version_id')::uuid, _c.version, _route, _rev, _uid, _facts->>'ai_state', _facts->>'check_outcome', _facts->'limitations', _facts->'reasons') RETURNING id INTO _aid;
  PERFORM set_config('markwise.content_transition', 'on', true);
  UPDATE public.contents SET status = CASE WHEN _route = 'reviewer' THEN 'pending_reviewer'::public.content_status ELSE 'pending_manager'::public.content_status END WHERE id = _c.id;
  PERFORM set_config('markwise.content_transition', 'off', true);
  PERFORM public.content_audit(_c.workspace_id, _uid, 'approval_requested', _c.id, jsonb_build_object('version', _c.version, 'approval_id', _aid, 'route', _route, 'reviewer_id', _rev, 'ai_state', _facts->>'ai_state', 'check_outcome', _facts->>'check_outcome', 'limitations', _facts->'limitations', 'reasons', _facts->'reasons'));
  RETURN _aid;
END $function$;
REVOKE ALL ON FUNCTION public.submit_for_approval(uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_for_approval(uuid, integer, uuid) TO authenticated;

-- Backfill: submitted content whose latest version already has a finished (partial) deterministic review becomes checked.
UPDATE public.contents c SET status = 'checked'
WHERE c.status = 'submitted' AND c.deleted_at IS NULL AND EXISTS (
  SELECT 1 FROM public.reviews r JOIN public.content_versions v ON v.id = r.content_version_id
  WHERE r.content_id = c.id AND v.version_number = c.version AND r.source = 'deterministic' AND r.status = 'partial');