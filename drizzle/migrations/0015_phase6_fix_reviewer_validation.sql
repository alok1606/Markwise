-- has_role() only answers for the signed-in user; validate the chosen reviewer's role directly.
CREATE OR REPLACE FUNCTION pg_temp.patch_fn(_sig text, _from text, _to text) RETURNS void LANGUAGE plpgsql AS $p$
DECLARE d text := pg_get_functiondef(_sig::regprocedure);
BEGIN
  IF strpos(d, _from) = 0 THEN RAISE EXCEPTION 'Patch target not found in %', _sig; END IF;
  EXECUTE replace(d, _from, _to);
END $p$;
SELECT pg_temp.patch_fn('public.submit_for_approval(uuid,integer,uuid)',
  $q$NOT public.has_role(_reviewer_id, 'reviewer', _c.workspace_id)$q$,
  $q$NOT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.workspace_members wm ON wm.user_id = ur.user_id AND wm.workspace_id = ur.workspace_id WHERE ur.user_id = _reviewer_id AND ur.workspace_id = _c.workspace_id AND ur.role = 'reviewer')$q$);