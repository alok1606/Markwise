-- Phase 6: review actions and approval workflow (additive).

CREATE OR REPLACE FUNCTION public.contents_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('markwise.content_purge', true) = 'on' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Content cannot be hard-deleted';
  END IF;
  IF NEW.workspace_id <> OLD.workspace_id OR NEW.owner_id <> OLD.owner_id OR NEW.type <> OLD.type THEN RAISE EXCEPTION 'Workspace, owner and type cannot change'; END IF;
  IF OLD.status NOT IN ('draft','changes_requested') AND current_setting('markwise.content_transition', true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'Submitted content cannot be edited'; END IF;
  IF OLD.status IN ('approved','rejected') AND NEW.status <> OLD.status THEN RAISE EXCEPTION 'Approved or rejected content is final'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.contents(id) ON DELETE RESTRICT,
  version_id uuid NOT NULL REFERENCES public.content_versions(id) ON DELETE RESTRICT,
  version_number integer NOT NULL,
  route text NOT NULL CHECK (route IN ('manager','reviewer')),
  reviewer_id uuid,
  assigned_by uuid NOT NULL,
  ai_state_at_routing text NOT NULL CHECK (ai_state_at_routing IN ('completed','failed')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','changes_requested','rejected')),
  decision_comment text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((route = 'reviewer') = (reviewer_id IS NOT NULL)),
  CHECK ((status = 'open') = (decided_at IS NULL)),
  CHECK (status = 'open' OR decided_by IS NOT NULL)
);
CREATE UNIQUE INDEX approvals_one_open ON public.approvals (content_id) WHERE status = 'open';
CREATE INDEX approvals_reviewer_idx ON public.approvals (reviewer_id, status);
CREATE INDEX approvals_content_idx ON public.approvals (content_id, created_at);

CREATE TABLE public.finding_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.contents(id) ON DELETE RESTRICT,
  version_id uuid NOT NULL REFERENCES public.content_versions(id) ON DELETE RESTRICT,
  finding_id uuid NOT NULL UNIQUE REFERENCES public.findings(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('accepted','edited','dismissed')),
  reason text,
  final_text text,
  result_version_id uuid REFERENCES public.content_versions(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (action <> 'dismissed' OR (reason IS NOT NULL AND length(btrim(reason)) BETWEEN 3 AND 1000)),
  CHECK ((action = 'dismissed') = (result_version_id IS NULL)),
  CHECK (action = 'dismissed' OR final_text IS NOT NULL)
);
CREATE INDEX finding_actions_content_idx ON public.finding_actions (content_id, created_at);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.contents(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES public.comments(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL,
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_content_idx ON public.comments (content_id, created_at);

GRANT SELECT ON public.approvals, public.finding_actions, public.comments TO authenticated;
GRANT ALL ON public.approvals, public.finding_actions, public.comments TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finding_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.phase6_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('markwise.content_purge', true) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION '% records are immutable', TG_TABLE_NAME;
END $$;
CREATE TRIGGER finding_actions_immutable BEFORE UPDATE OR DELETE ON public.finding_actions FOR EACH ROW EXECUTE FUNCTION public.phase6_immutable();
CREATE TRIGGER comments_immutable BEFORE UPDATE OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.phase6_immutable();
CREATE OR REPLACE FUNCTION public.approvals_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('markwise.content_purge', true) = 'on' THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Approval records are immutable'; END IF;
  IF OLD.status <> 'open' THEN RAISE EXCEPTION 'Approval decisions are final'; END IF;
  IF NEW.id <> OLD.id OR NEW.content_id <> OLD.content_id OR NEW.version_id <> OLD.version_id OR NEW.route <> OLD.route OR NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
     OR NEW.assigned_by <> OLD.assigned_by OR NEW.created_at <> OLD.created_at OR NEW.workspace_id <> OLD.workspace_id OR NEW.ai_state_at_routing <> OLD.ai_state_at_routing THEN
    RAISE EXCEPTION 'Approval routing cannot change'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER approvals_guard BEFORE UPDATE OR DELETE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.approvals_guard();

CREATE OR REPLACE FUNCTION public.is_assigned_reviewer(_content_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.approvals a JOIN public.contents c ON c.id = a.content_id
    WHERE a.content_id = _content_id AND a.reviewer_id = auth.uid() AND c.deleted_at IS NULL AND public.has_role(auth.uid(), 'reviewer', a.workspace_id))
$$;
REVOKE ALL ON FUNCTION public.is_assigned_reviewer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_reviewer(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_content(_content_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contents c
    WHERE c.id = _content_id AND c.deleted_at IS NULL AND (
      (c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'creator', c.workspace_id))
      OR (c.status <> 'draft' AND public.has_role(auth.uid(), 'manager', c.workspace_id))
    )) OR public.is_assigned_reviewer(_content_id)
$$;
DROP POLICY contents_read ON public.contents;
CREATE POLICY contents_read ON public.contents FOR SELECT TO authenticated USING (
  deleted_at IS NULL AND (
    (owner_id = auth.uid() AND public.has_role(auth.uid(), 'creator', workspace_id))
    OR (status <> 'draft' AND public.has_role(auth.uid(), 'manager', workspace_id))
    OR public.is_assigned_reviewer(id)
  ));

CREATE POLICY approvals_read ON public.approvals FOR SELECT TO authenticated USING (public.can_read_content(content_id));
CREATE POLICY finding_actions_read ON public.finding_actions FOR SELECT TO authenticated USING (public.can_read_content(content_id));
CREATE POLICY comments_read ON public.comments FOR SELECT TO authenticated USING (public.can_read_content(content_id));

CREATE OR REPLACE FUNCTION public.can_upload_content_file(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.contents c WHERE c.id = public.content_file_content_id(_name)
    AND split_part(_name, '/', 1) = c.workspace_id::text AND c.owner_id = auth.uid() AND c.status IN ('draft','changes_requested') AND c.deleted_at IS NULL AND c.type <> 'text'
    AND public.has_role(auth.uid(), 'creator', c.workspace_id))
$$;

CREATE OR REPLACE FUNCTION public.ai_state(_version_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.reviews WHERE content_version_id = _version_id AND source = 'ai') THEN 'completed'
    WHEN EXISTS (SELECT 1 FROM public.ai_calls WHERE content_version_id = _version_id AND status = 'failed' AND coalesce(error_kind,'') <> 'already_reviewed') THEN 'failed'
    ELSE 'pending' END
$$;
REVOKE ALL ON FUNCTION public.ai_state(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.act_on_finding(_actor uuid, _content_id uuid, _expected_version integer, _finding_id uuid, _action text, _reason text, _final_text text, _new_body text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.contents; _v public.content_versions; _f public.findings; _nv public.content_versions;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _actor OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _actor AND workspace_id = _c.workspace_id AND role = 'creator') THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'checked' THEN RAISE EXCEPTION 'Findings can be acted on only after checking and before sending for approval'; END IF;
  IF _c.version <> _expected_version THEN RAISE EXCEPTION 'This content changed since you opened it; reload and try again'; END IF;
  SELECT * INTO _v FROM public.content_versions WHERE content_id = _c.id AND version_number = _c.version;
  SELECT f.* INTO _f FROM public.findings f JOIN public.reviews r ON r.id = f.review_id WHERE f.id = _finding_id AND f.content_id = _c.id AND r.content_version_id = _v.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Finding does not belong to the latest checked version'; END IF;
  IF EXISTS (SELECT 1 FROM public.finding_actions WHERE finding_id = _finding_id) THEN RAISE EXCEPTION 'This finding was already resolved'; END IF;
  IF _action = 'dismissed' THEN
    IF length(btrim(coalesce(_reason,''))) < 3 OR length(_reason) > 1000 THEN RAISE EXCEPTION 'A dismissal reason (3–1000 characters) is required'; END IF;
    INSERT INTO public.finding_actions (workspace_id, content_id, version_id, finding_id, action, reason, actor_id) VALUES (_c.workspace_id, _c.id, _v.id, _f.id, 'dismissed', btrim(_reason), _actor);
    PERFORM public.content_audit(_c.workspace_id, _actor, 'finding_dismissed', _c.id, jsonb_build_object('version', _c.version, 'finding_id', _f.id, 'reason', btrim(_reason)));
    RETURN _c.version;
  ELSIF _action IN ('accepted','edited') THEN
    IF _c.type = 'image' OR _f.span_start IS NULL THEN RAISE EXCEPTION 'This finding has no text to rewrite; dismiss it with a reason instead'; END IF;
    IF _final_text IS NULL OR length(_final_text) > 2000 OR _new_body IS NULL THEN RAISE EXCEPTION 'Replacement text is required'; END IF;
    IF _action = 'accepted' AND (_f.suggested_text IS NULL OR _final_text <> _f.suggested_text) THEN RAISE EXCEPTION 'Accept must use the suggested text exactly'; END IF;
    IF strpos(_c.body_text, _f.quoted_text) = 0 OR (_final_text <> '' AND strpos(_new_body, _final_text) = 0) OR _new_body = _c.body_text THEN RAISE EXCEPTION 'Rewrite does not match the finding'; END IF;
    PERFORM public.content_validate(_c.title, _c.channel, _c.audience, _c.goal, _new_body, _c.alt_text, _c.text_color, _c.background_color);
    PERFORM set_config('markwise.content_transition', 'on', true);
    UPDATE public.contents SET body_text = _new_body, version = _c.version + 1, status = 'submitted', submitted_at = now() WHERE id = _c.id RETURNING * INTO _c;
    PERFORM set_config('markwise.content_transition', 'off', true);
    PERFORM public.content_snapshot(_c, _actor, CASE WHEN _action = 'accepted' THEN 'Suggestion accepted' ELSE 'Suggestion edited' END);
    SELECT * INTO _nv FROM public.content_versions WHERE content_id = _c.id AND version_number = _c.version;
    INSERT INTO public.finding_actions (workspace_id, content_id, version_id, finding_id, action, final_text, result_version_id, actor_id)
      VALUES (_c.workspace_id, _c.id, _v.id, _f.id, _action, _final_text, _nv.id, _actor);
    PERFORM public.content_audit(_c.workspace_id, _actor, 'finding_' || _action, _c.id, jsonb_build_object('from_version', _v.version_number, 'version', _c.version, 'finding_id', _f.id));
    RETURN _c.version;
  END IF;
  RAISE EXCEPTION 'Unknown action';
END $$;
REVOKE ALL ON FUNCTION public.act_on_finding(uuid, uuid, integer, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_finding(uuid, uuid, integer, uuid, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.approval_route_facts(_content_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.contents; _v public.content_versions; _blocking int; _needs boolean; _ai text;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL;
  IF NOT FOUND OR NOT public.can_read_content(_content_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  SELECT * INTO _v FROM public.content_versions WHERE content_id = _c.id AND version_number = _c.version;
  _ai := public.ai_state(_v.id);
  SELECT count(*) INTO _blocking FROM public.findings f JOIN public.reviews r ON r.id = f.review_id
    WHERE r.content_version_id = _v.id AND f.severity IN ('high','critical') AND f.outcome <> 'supported'
      AND NOT EXISTS (SELECT 1 FROM public.finding_actions a WHERE a.finding_id = f.id);
  SELECT EXISTS (SELECT 1 FROM public.findings f JOIN public.reviews r ON r.id = f.review_id
    WHERE r.content_version_id = _v.id AND (f.category IN ('claim','legal') OR f.outcome = 'cannot_verify')) INTO _needs;
  RETURN jsonb_build_object('version', _c.version, 'version_id', _v.id, 'status', _c.status, 'ai_state', _ai, 'blocking', _blocking, 'route', CASE WHEN _needs THEN 'reviewer' ELSE 'manager' END);
END $$;
REVOKE ALL ON FUNCTION public.approval_route_facts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approval_route_facts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_for_approval(_content_id uuid, _expected_version integer, _reviewer_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.contents; _facts jsonb; _route text; _rev uuid; _aid uuid;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _uid OR NOT public.has_role(_uid, 'creator', _c.workspace_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'checked' THEN RAISE EXCEPTION 'Only checked content can be sent for approval'; END IF;
  IF _c.version <> _expected_version THEN RAISE EXCEPTION 'This content changed since you opened it; reload and try again'; END IF;
  _facts := public.approval_route_facts(_content_id);
  IF _facts->>'ai_state' = 'pending' THEN RAISE EXCEPTION 'The AI review has not finished for this version; wait for it or run it again'; END IF;
  IF (_facts->>'blocking')::int > 0 THEN RAISE EXCEPTION 'Resolve all high and critical findings before sending for approval'; END IF;
  _route := _facts->>'route';
  IF _route = 'reviewer' THEN
    IF _reviewer_id IS NULL THEN RAISE EXCEPTION 'This content needs a named reviewer'; END IF;
    IF _reviewer_id = _uid OR NOT public.has_role(_reviewer_id, 'reviewer', _c.workspace_id) THEN RAISE EXCEPTION 'Choose a reviewer from this workspace'; END IF;
    _rev := _reviewer_id;
  END IF;
  INSERT INTO public.approvals (workspace_id, content_id, version_id, version_number, route, reviewer_id, assigned_by, ai_state_at_routing)
    VALUES (_c.workspace_id, _c.id, (_facts->>'version_id')::uuid, _c.version, _route, _rev, _uid, _facts->>'ai_state') RETURNING id INTO _aid;
  PERFORM set_config('markwise.content_transition', 'on', true);
  UPDATE public.contents SET status = CASE WHEN _route = 'reviewer' THEN 'pending_reviewer'::public.content_status ELSE 'pending_manager'::public.content_status END WHERE id = _c.id;
  PERFORM set_config('markwise.content_transition', 'off', true);
  PERFORM public.content_audit(_c.workspace_id, _uid, 'approval_requested', _c.id, jsonb_build_object('version', _c.version, 'approval_id', _aid, 'route', _route, 'reviewer_id', _rev, 'ai_state', _facts->>'ai_state'));
  RETURN _aid;
END $$;
REVOKE ALL ON FUNCTION public.submit_for_approval(uuid, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_for_approval(uuid, integer, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_approval(_approval_id uuid, _expected_version integer, _decision text, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _a public.approvals; _c public.contents; _cm text := nullif(btrim(coalesce(_comment,'')), '');
BEGIN
  SELECT * INTO _a FROM public.approvals WHERE id = _approval_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approval not found'; END IF;
  SELECT * INTO _c FROM public.contents WHERE id = _a.content_id AND deleted_at IS NULL FOR UPDATE;
  SELECT * INTO _a FROM public.approvals WHERE id = _approval_id FOR UPDATE;
  IF _uid IS NULL OR NOT FOUND THEN RAISE EXCEPTION 'Approval not found'; END IF;
  IF _a.route = 'manager' AND NOT public.has_role(_uid, 'manager', _a.workspace_id) THEN RAISE EXCEPTION 'Only a manager of this workspace can decide this item'; END IF;
  IF _a.route = 'reviewer' AND (_a.reviewer_id <> _uid OR NOT public.has_role(_uid, 'reviewer', _a.workspace_id)) THEN RAISE EXCEPTION 'Only the assigned reviewer can decide this item'; END IF;
  IF _c.owner_id = _uid THEN RAISE EXCEPTION 'You cannot approve your own content'; END IF;
  IF _a.status <> 'open' THEN RAISE EXCEPTION 'This item was already decided'; END IF;
  IF _c.status::text <> 'pending_' || _a.route OR _c.version <> _a.version_number OR _c.version <> _expected_version THEN RAISE EXCEPTION 'This content changed; reload before deciding'; END IF;
  IF _decision NOT IN ('approved','changes_requested','rejected') THEN RAISE EXCEPTION 'Unknown decision'; END IF;
  IF (_a.route = 'reviewer' OR _decision <> 'approved') AND _cm IS NULL THEN RAISE EXCEPTION 'A comment is required for this decision'; END IF;
  IF length(coalesce(_cm,'')) > 4000 THEN RAISE EXCEPTION 'Comment is limited to 4,000 characters'; END IF;
  UPDATE public.approvals SET status = _decision, decision_comment = _cm, decided_by = _uid, decided_at = now() WHERE id = _a.id;
  PERFORM set_config('markwise.content_transition', 'on', true);
  UPDATE public.contents SET status = _decision::public.content_status WHERE id = _c.id;
  PERFORM set_config('markwise.content_transition', 'off', true);
  PERFORM public.content_audit(_a.workspace_id, _uid, 'approval_' || _decision, _c.id, jsonb_build_object('version', _c.version, 'approval_id', _a.id, 'route', _a.route, 'comment', _cm));
END $$;
REVOKE ALL ON FUNCTION public.decide_approval(uuid, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_approval(uuid, integer, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_comment(_content_id uuid, _parent_id uuid, _message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.contents; _id uuid;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL;
  IF _uid IS NULL OR NOT FOUND OR NOT public.can_read_content(_content_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status = 'draft' THEN RAISE EXCEPTION 'Comments open once content is submitted'; END IF;
  IF length(btrim(coalesce(_message,''))) = 0 OR length(_message) > 4000 THEN RAISE EXCEPTION 'Comment must be 1–4,000 characters'; END IF;
  IF _parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.comments WHERE id = _parent_id AND content_id = _content_id) THEN RAISE EXCEPTION 'Reply must belong to the same content'; END IF;
  INSERT INTO public.comments (workspace_id, content_id, parent_id, author_id, message) VALUES (_c.workspace_id, _c.id, _parent_id, _uid, btrim(_message)) RETURNING id INTO _id;
  PERFORM public.content_audit(_c.workspace_id, _uid, 'comment_added', _c.id, jsonb_build_object('comment_id', _id, 'parent_id', _parent_id));
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.add_comment(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_comment(uuid, uuid, text) TO authenticated;

-- Narrow, verified text patches of existing Phase 3-5 functions (everything else in them unchanged).
CREATE OR REPLACE FUNCTION pg_temp.patch_fn(_sig text, _from text, _to text) RETURNS void LANGUAGE plpgsql AS $p$
DECLARE d text := pg_get_functiondef(_sig::regprocedure);
BEGIN
  IF strpos(d, _from) = 0 THEN RAISE EXCEPTION 'Patch target not found in %', _sig; END IF;
  EXECUTE replace(d, _from, _to);
END $p$;
SELECT pg_temp.patch_fn('public.submit_content(uuid,integer)', $q$IF _c.status <> 'draft' THEN RAISE EXCEPTION 'Content is already submitted'$q$, $q$IF _c.status NOT IN ('draft','changes_requested') THEN RAISE EXCEPTION 'Content is already submitted'$q$);
SELECT pg_temp.patch_fn('public.save_content_draft(uuid,integer,text,text,text,text,text,text,text,text,boolean)', $q$IF _c.status <> 'draft' THEN$q$, $q$IF _c.status NOT IN ('draft','changes_requested') THEN$q$);
SELECT pg_temp.patch_fn('public.set_content_file(uuid,uuid,integer,text,text,text,integer)', $q$IF _c.status <> 'draft' THEN$q$, $q$IF _c.status NOT IN ('draft','changes_requested') THEN$q$);
SELECT pg_temp.patch_fn('public.record_review(uuid,uuid,uuid,jsonb,integer,jsonb)', $q$  PERFORM public.content_audit(_c.workspace_id, _actor, 'review_completed'$q$,
$q$  IF jsonb_array_length(coalesce(_limitations,'[]')) = 0 THEN
    PERFORM set_config('markwise.content_transition', 'on', true);
    UPDATE public.contents SET status = 'checked' WHERE id = _c.id;
    PERFORM set_config('markwise.content_transition', 'off', true);
  END IF;
  PERFORM public.content_audit(_c.workspace_id, _actor, 'review_completed'$q$);
SELECT pg_temp.patch_fn('public.record_ai_review(uuid,uuid,uuid,jsonb,integer,integer,jsonb,text,text,text,text,text)', $q$IF _c.status <> 'submitted' THEN RAISE EXCEPTION 'AI review runs only on submitted content'; END IF;$q$,
$q$IF _c.status NOT IN ('submitted','checked') THEN RAISE EXCEPTION 'AI review is closed for this content'; END IF;
  IF EXISTS (SELECT 1 FROM public.approvals a JOIN public.content_versions cv ON cv.id = a.version_id WHERE a.content_id = _c.id AND cv.version_number = _c.version) THEN RAISE EXCEPTION 'AI review is closed: this version was already routed for approval'; END IF;$q$);

SELECT set_config('markwise.content_transition', 'on', true);
UPDATE public.contents c SET status = 'checked'
WHERE c.status = 'submitted' AND c.deleted_at IS NULL AND EXISTS (
  SELECT 1 FROM public.reviews r JOIN public.content_versions v ON v.id = r.content_version_id
  WHERE r.content_id = c.id AND v.version_number = c.version AND r.source = 'deterministic' AND r.status = 'completed');
SELECT set_config('markwise.content_transition', 'off', true);

CREATE OR REPLACE FUNCTION public.purge_workspace_content(_workspace_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM set_config('markwise.content_purge', 'on', true);
  DELETE FROM public.comments WHERE workspace_id = _workspace_id;
  DELETE FROM public.finding_actions WHERE workspace_id = _workspace_id;
  DELETE FROM public.approvals WHERE workspace_id = _workspace_id;
  DELETE FROM public.ai_calls WHERE workspace_id = _workspace_id;
  DELETE FROM public.findings WHERE workspace_id = _workspace_id;
  DELETE FROM public.reviews WHERE workspace_id = _workspace_id;
  DELETE FROM public.content_versions WHERE workspace_id = _workspace_id;
  DELETE FROM public.contents WHERE workspace_id = _workspace_id;
  PERFORM set_config('markwise.content_transition', 'off', true);
  PERFORM set_config('markwise.content_purge', 'off', true);
END $function$;