-- Keep the Phase 4 "already ran" answer for a second review: checked content always already has its deterministic review,
-- so it passes the status gate and is refused by the existing one-review-per-version check.
CREATE OR REPLACE FUNCTION pg_temp.patch_fn(_sig text, _from text, _to text) RETURNS void LANGUAGE plpgsql AS $p$
DECLARE d text := pg_get_functiondef(_sig::regprocedure);
BEGIN
  IF strpos(d, _from) = 0 THEN RAISE EXCEPTION 'Patch target not found in %', _sig; END IF;
  EXECUTE replace(d, _from, _to);
END $p$;
SELECT pg_temp.patch_fn('public.record_review(uuid,uuid,uuid,jsonb,integer,jsonb)',
  $q$IF _c.status <> 'submitted' THEN RAISE EXCEPTION 'Checks run only on submitted content'; END IF;$q$,
  $q$IF _c.status NOT IN ('submitted','checked') THEN RAISE EXCEPTION 'Checks run only on submitted content'; END IF;
  IF _c.status = 'checked' AND NOT EXISTS (SELECT 1 FROM public.reviews r JOIN public.content_versions v ON v.id = r.content_version_id WHERE r.content_id = _c.id AND v.version_number = _c.version AND r.source = 'deterministic') THEN RAISE EXCEPTION 'Checks run only on submitted content'; END IF;$q$);