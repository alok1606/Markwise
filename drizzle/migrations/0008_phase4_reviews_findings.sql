CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.contents(id),
  content_version_id uuid NOT NULL UNIQUE REFERENCES public.content_versions(id),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  version_number integer NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  run_by uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('completed','partial')),
  dropped_findings_count integer NOT NULL DEFAULT 0 CHECK (dropped_findings_count >= 0),
  finding_count integer NOT NULL DEFAULT 0,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_content_idx ON public.reviews(content_id);
CREATE TABLE public.findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id),
  content_id uuid NOT NULL REFERENCES public.contents(id),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  source text NOT NULL DEFAULT 'deterministic' CHECK (source IN ('deterministic')),
  check_name text NOT NULL CHECK (check_name IN ('banned_term','terminology','numeric_claim','alt_text','contrast','palette')),
  category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  confidence numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  span_start integer, span_end integer,
  quoted_text text NOT NULL DEFAULT '',
  explanation text NOT NULL,
  cited_kind text NOT NULL CHECK (cited_kind IN ('rule','glossary','palette','wcag','spec')),
  cited_id uuid,
  cited_code text NOT NULL DEFAULT '',
  cited_passage text NOT NULL DEFAULT '',
  outcome text NOT NULL CHECK (outcome IN ('violation','cannot_verify')),
  suggested_text text, final_text text, dismissal_reason text, decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((span_start IS NULL AND span_end IS NULL) OR (span_start >= 0 AND span_end > span_start))
);
CREATE INDEX findings_review_idx ON public.findings(review_id);
GRANT SELECT ON public.reviews, public.findings TO authenticated;
GRANT ALL ON public.reviews, public.findings TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_read ON public.reviews FOR SELECT TO authenticated USING (public.can_read_content(content_id));
CREATE POLICY findings_read ON public.findings FOR SELECT TO authenticated USING (public.can_read_content(content_id));

CREATE OR REPLACE FUNCTION public.reviews_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('markwise.content_purge', true) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Reviews and findings are immutable';
END $$;
CREATE TRIGGER reviews_immutable BEFORE UPDATE OR DELETE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.reviews_immutable();
CREATE TRIGGER findings_immutable BEFORE UPDATE OR DELETE ON public.findings FOR EACH ROW EXECUTE FUNCTION public.reviews_immutable();

-- Atomic, server-only recording of one deterministic review for the exact submitted version.
CREATE OR REPLACE FUNCTION public.record_review(_actor uuid, _content_id uuid, _content_version_id uuid, _findings jsonb, _dropped integer, _limitations jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _c public.contents; _v public.content_versions; _rid uuid; f jsonb; _n int := 0;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _actor OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _actor AND workspace_id = _c.workspace_id AND role = 'creator') THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'submitted' THEN RAISE EXCEPTION 'Checks run only on submitted content'; END IF;
  SELECT * INTO _v FROM public.content_versions WHERE id = _content_version_id AND content_id = _c.id;
  IF NOT FOUND OR _v.version_number <> _c.version THEN RAISE EXCEPTION 'Checks must use the exact submitted version'; END IF;
  IF EXISTS (SELECT 1 FROM public.reviews WHERE content_version_id = _v.id) THEN RAISE EXCEPTION 'Checks already ran for this version'; END IF;
  IF jsonb_typeof(_findings) <> 'array' OR jsonb_array_length(_findings) > 500 THEN RAISE EXCEPTION 'Invalid findings'; END IF;
  INSERT INTO public.reviews (content_id, content_version_id, workspace_id, version_number, run_by, status, dropped_findings_count, finding_count, limitations)
  VALUES (_c.id, _v.id, _c.workspace_id, _v.version_number, _actor, CASE WHEN jsonb_array_length(coalesce(_limitations,'[]')) > 0 THEN 'partial' ELSE 'completed' END, greatest(coalesce(_dropped,0),0), jsonb_array_length(_findings), coalesce(_limitations,'[]'))
  RETURNING id INTO _rid;
  FOR f IN SELECT * FROM jsonb_array_elements(_findings) LOOP
    IF f->>'cited_kind' = 'rule' AND NOT EXISTS (SELECT 1 FROM public.rules WHERE id = (f->>'cited_id')::uuid AND workspace_id = _c.workspace_id AND code = f->>'cited_code') THEN RAISE EXCEPTION 'Finding cites a rule outside this workspace'; END IF;
    IF f->>'cited_kind' = 'glossary' AND NOT EXISTS (SELECT 1 FROM public.glossary WHERE id = (f->>'cited_id')::uuid AND workspace_id = _c.workspace_id) THEN RAISE EXCEPTION 'Finding cites a glossary entry outside this workspace'; END IF;
    IF f->>'cited_kind' = 'palette' AND f->>'cited_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.palette WHERE id = (f->>'cited_id')::uuid AND workspace_id = _c.workspace_id) THEN RAISE EXCEPTION 'Finding cites a palette colour outside this workspace'; END IF;
    IF f->>'cited_kind' IN ('wcag','spec') AND f->>'cited_id' IS NOT NULL THEN RAISE EXCEPTION 'Invalid citation'; END IF;
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

CREATE OR REPLACE FUNCTION public.purge_workspace_content(_workspace_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM set_config('markwise.content_purge', 'on', true);
  DELETE FROM public.findings WHERE workspace_id = _workspace_id;
  DELETE FROM public.reviews WHERE workspace_id = _workspace_id;
  DELETE FROM public.content_versions WHERE workspace_id = _workspace_id;
  DELETE FROM public.contents WHERE workspace_id = _workspace_id;
  PERFORM set_config('markwise.content_purge', 'off', true);
END $function$;