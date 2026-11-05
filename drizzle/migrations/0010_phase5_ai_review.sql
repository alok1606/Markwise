-- Phase 5: AI reviews alongside (never replacing) deterministic reviews.
ALTER TABLE public.reviews ADD COLUMN source text NOT NULL DEFAULT 'deterministic' CHECK (source IN ('deterministic','ai'));
ALTER TABLE public.reviews ADD COLUMN model text, ADD COLUMN prompt_version text, ADD COLUMN evidence_text text, ADD COLUMN file_sha256 text, ADD COLUMN downgraded_findings_count integer NOT NULL DEFAULT 0 CHECK (downgraded_findings_count >= 0);
ALTER TABLE public.reviews DROP CONSTRAINT reviews_content_version_id_key;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_version_source_key UNIQUE (content_version_id, source);

ALTER TABLE public.findings DROP CONSTRAINT findings_source_check;
ALTER TABLE public.findings ADD CONSTRAINT findings_source_check CHECK (source IN ('deterministic','ai'));
ALTER TABLE public.findings DROP CONSTRAINT findings_check_name_check;
ALTER TABLE public.findings ADD CONSTRAINT findings_check_name_check CHECK (check_name IN ('banned_term','terminology','numeric_claim','alt_text','contrast','palette','ai_review'));
ALTER TABLE public.findings DROP CONSTRAINT findings_cited_kind_check;
ALTER TABLE public.findings ADD CONSTRAINT findings_cited_kind_check CHECK (cited_kind IN ('rule','glossary','palette','wcag','spec','fact','none'));
ALTER TABLE public.findings DROP CONSTRAINT findings_outcome_check;
ALTER TABLE public.findings ADD CONSTRAINT findings_outcome_check CHECK (outcome IN ('violation','cannot_verify','supported','contradicted'));
ALTER TABLE public.findings ADD COLUMN evidence_kind text NOT NULL DEFAULT 'text' CHECK (evidence_kind IN ('text','image_ocr'));
ALTER TABLE public.findings ADD COLUMN bbox jsonb;

-- AI call log: immutable, Admin-readable per workspace, written only by the server.
CREATE TABLE public.ai_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  content_id uuid NOT NULL REFERENCES public.contents(id),
  content_version_id uuid NOT NULL REFERENCES public.content_versions(id),
  review_id uuid REFERENCES public.reviews(id),
  requested_by uuid NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  what_was_sent_summary text NOT NULL,
  status text NOT NULL CHECK (status IN ('succeeded','failed')),
  error_kind text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_calls_content_idx ON public.ai_calls(content_id);
GRANT SELECT ON public.ai_calls TO authenticated;
GRANT ALL ON public.ai_calls TO service_role;
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_calls_admin_read ON public.ai_calls FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin', workspace_id));
CREATE TRIGGER ai_calls_immutable BEFORE UPDATE OR DELETE ON public.ai_calls FOR EACH ROW EXECUTE FUNCTION public.reviews_immutable();

-- Deterministic recording only checks for an existing deterministic review now.
CREATE OR REPLACE FUNCTION public.record_review(_actor uuid, _content_id uuid, _content_version_id uuid, _findings jsonb, _dropped integer, _limitations jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _c public.contents; _v public.content_versions; _rid uuid; f jsonb; _n int := 0;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _actor OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _actor AND workspace_id = _c.workspace_id AND role = 'creator') THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'submitted' THEN RAISE EXCEPTION 'Checks run only on submitted content'; END IF;
  SELECT * INTO _v FROM public.content_versions WHERE id = _content_version_id AND content_id = _c.id;
  IF NOT FOUND OR _v.version_number <> _c.version THEN RAISE EXCEPTION 'Checks must use the exact submitted version'; END IF;
  IF EXISTS (SELECT 1 FROM public.reviews WHERE content_version_id = _v.id AND source = 'deterministic') THEN RAISE EXCEPTION 'Checks already ran for this version'; END IF;
  IF jsonb_typeof(_findings) <> 'array' OR jsonb_array_length(_findings) > 500 THEN RAISE EXCEPTION 'Invalid findings'; END IF;
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
  PERFORM public.content_audit(_c.workspace_id, _actor, 'review_completed', _c.id, jsonb_build_object('version', _v.version_number, 'review_id', _rid, 'findings', _n, 'dropped', greatest(coalesce(_dropped,0),0), 'limitations', jsonb_array_length(coalesce(_limitations,'[]'))));
  RETURN _rid;
END $$;
REVOKE ALL ON FUNCTION public.record_review(uuid, uuid, uuid, jsonb, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_review(uuid, uuid, uuid, jsonb, integer, jsonb) TO service_role;

-- Atomic, server-only recording of one AI review for the exact submitted version.
-- Re-validates every citation in the database (defence in depth behind the server validator).
CREATE OR REPLACE FUNCTION public.record_ai_review(_actor uuid, _content_id uuid, _content_version_id uuid, _findings jsonb, _dropped integer, _downgraded integer, _limitations jsonb, _model text, _prompt_version text, _evidence_text text, _file_sha256 text, _ai_call_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _c public.contents; _v public.content_versions; _rid uuid; f jsonb; _n int := 0; _kind text; _pass text; _id uuid; _ok boolean;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _actor OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _actor AND workspace_id = _c.workspace_id AND role = 'creator') THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'submitted' THEN RAISE EXCEPTION 'AI review runs only on submitted content'; END IF;
  SELECT * INTO _v FROM public.content_versions WHERE id = _content_version_id AND content_id = _c.id;
  IF NOT FOUND OR _v.version_number <> _c.version THEN RAISE EXCEPTION 'AI review must use the exact submitted version'; END IF;
  IF EXISTS (SELECT 1 FROM public.reviews WHERE content_version_id = _v.id AND source = 'ai') THEN RAISE EXCEPTION 'AI review already exists for this version'; END IF;
  IF jsonb_typeof(_findings) <> 'array' OR jsonb_array_length(_findings) > 200 THEN RAISE EXCEPTION 'Invalid findings'; END IF;
  IF _c.type = 'image' AND (_file_sha256 IS NULL OR _file_sha256 !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'Image review requires the exact image fingerprint'; END IF;
  INSERT INTO public.reviews (content_id, content_version_id, workspace_id, version_number, run_by, status, dropped_findings_count, downgraded_findings_count, finding_count, limitations, source, model, prompt_version, evidence_text, file_sha256)
  VALUES (_c.id, _v.id, _c.workspace_id, _v.version_number, _actor, CASE WHEN jsonb_array_length(coalesce(_limitations,'[]')) > 0 THEN 'partial' ELSE 'completed' END,
    greatest(coalesce(_dropped,0),0), greatest(coalesce(_downgraded,0),0), jsonb_array_length(_findings), coalesce(_limitations,'[]'), 'ai', left(_model,100), left(_prompt_version,40), left(_evidence_text,20000), _file_sha256)
  RETURNING id INTO _rid;
  FOR f IN SELECT * FROM jsonb_array_elements(_findings) LOOP
    _kind := f->>'cited_kind'; _pass := coalesce(f->>'cited_passage',''); _id := nullif(f->>'cited_id','')::uuid;
    IF f->>'outcome' NOT IN ('violation','cannot_verify','supported','contradicted') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
    IF _kind = 'none' THEN
      IF _id IS NOT NULL OR coalesce(f->>'cited_code','') <> '' OR _pass <> '' OR f->>'outcome' <> 'cannot_verify' THEN RAISE EXCEPTION 'Uncited findings must be cannot_verify'; END IF;
    ELSIF _kind = 'rule' THEN
      SELECT true INTO _ok FROM public.rules r WHERE r.id = _id AND r.workspace_id = _c.workspace_id AND r.active AND r.code = f->>'cited_code'
        AND _pass <> '' AND strpos(lower(r.title || E'\n' || r.description || E'\n' || r.explanation || E'\n' || r.examples), lower(_pass)) > 0;
      IF NOT coalesce(_ok,false) OR f->>'outcome' <> 'violation' THEN RAISE EXCEPTION 'Finding cites an invalid rule'; END IF;
    ELSIF _kind = 'fact' THEN
      SELECT true INTO _ok FROM public.facts x WHERE x.id = _id AND x.workspace_id = _c.workspace_id AND x.active AND x.status = 'approved' AND x.code = f->>'cited_code'
        AND (x.valid_from IS NULL OR x.valid_from <= current_date) AND (x.valid_until IS NULL OR x.valid_until >= current_date)
        AND _pass <> '' AND strpos(lower(x.statement || E'\n' || x.evidence), lower(_pass)) > 0;
      IF NOT coalesce(_ok,false) OR f->>'outcome' NOT IN ('supported','contradicted') THEN RAISE EXCEPTION 'Finding cites an invalid fact'; END IF;
    ELSIF _kind = 'glossary' THEN
      SELECT true INTO _ok FROM public.glossary g WHERE g.id = _id AND g.workspace_id = _c.workspace_id
        AND _pass <> '' AND strpos(lower(g.preferred_term || E'\n' || array_to_string(g.avoided_terms, E'\n') || E'\n' || g.note || E'\n' || g.usage_example), lower(_pass)) > 0;
      IF NOT coalesce(_ok,false) OR f->>'outcome' <> 'violation' THEN RAISE EXCEPTION 'Finding cites an invalid glossary entry'; END IF;
    ELSE RAISE EXCEPTION 'Invalid citation kind';
    END IF;
    _ok := NULL;
    INSERT INTO public.findings (review_id, content_id, workspace_id, source, check_name, category, severity, confidence, span_start, span_end, quoted_text, explanation, cited_kind, cited_id, cited_code, cited_passage, outcome, suggested_text, evidence_kind, bbox)
    VALUES (_rid, _c.id, _c.workspace_id, 'ai', 'ai_review', left(f->>'category',40), f->>'severity', (f->>'confidence')::numeric, (f->>'span_start')::int, (f->>'span_end')::int,
      left(coalesce(f->>'quoted_text',''),1000), left(f->>'explanation',2000), _kind, _id, left(coalesce(f->>'cited_code',''),60), left(_pass,2000), f->>'outcome',
      left(nullif(f->>'suggested_text',''),2000), coalesce(f->>'evidence_kind','text'), CASE WHEN jsonb_typeof(f->'bbox') = 'array' THEN f->'bbox' ELSE NULL END);
    _n := _n + 1;
  END LOOP;
  IF _ai_call_id IS NOT NULL THEN
    INSERT INTO public.ai_calls (workspace_id, content_id, content_version_id, review_id, requested_by, provider, model, prompt_version, what_was_sent_summary, status)
    SELECT workspace_id, content_id, content_version_id, _rid, requested_by, provider, model, prompt_version, what_was_sent_summary, 'succeeded' FROM public.ai_calls WHERE id = _ai_call_id AND content_version_id = _v.id;
  END IF;
  PERFORM public.content_audit(_c.workspace_id, _actor, 'ai_review_completed', _c.id, jsonb_build_object('version', _v.version_number, 'review_id', _rid, 'findings', _n, 'dropped', greatest(coalesce(_dropped,0),0), 'downgraded', greatest(coalesce(_downgraded,0),0), 'model', _model));
  RETURN _rid;
END $$;
REVOKE ALL ON FUNCTION public.record_ai_review(uuid, uuid, uuid, jsonb, integer, integer, jsonb, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_review(uuid, uuid, uuid, jsonb, integer, integer, jsonb, text, text, text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_workspace_content(_workspace_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM set_config('markwise.content_purge', 'on', true);
  DELETE FROM public.ai_calls WHERE workspace_id = _workspace_id;
  DELETE FROM public.findings WHERE workspace_id = _workspace_id;
  DELETE FROM public.reviews WHERE workspace_id = _workspace_id;
  DELETE FROM public.content_versions WHERE workspace_id = _workspace_id;
  DELETE FROM public.contents WHERE workspace_id = _workspace_id;
  PERFORM set_config('markwise.content_purge', 'off', true);
END $function$;