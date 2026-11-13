BEGIN;

-- Migration 0021 redefines these existing functions to add DOCX/PPTX support.
-- Restore Phase 6's established ability to edit and resubmit returned content.
-- The exact-body patches preserve all Office validation and permissions added
-- by 0021 and change only the eligible-status predicates.
CREATE FUNCTION pg_temp.patch_fn(_sig text, _from text, _to text)
RETURNS void LANGUAGE plpgsql AS $patch$
DECLARE definition text := pg_get_functiondef(_sig::regprocedure);
BEGIN
  IF strpos(definition, _from) = 0 THEN
    RAISE EXCEPTION 'Expected function body fragment not found in %', _sig;
  END IF;
  EXECUTE replace(definition, _from, _to);
END
$patch$;

SELECT pg_temp.patch_fn(
  'public.save_content_draft(uuid,integer,text,text,text,text,text,text,text,text,boolean)',
  $old$IF _c.status <> 'draft' THEN RAISE EXCEPTION 'Submitted content cannot be edited'; END IF;$old$,
  $new$IF _c.status NOT IN ('draft','changes_requested') THEN RAISE EXCEPTION 'Submitted content cannot be edited'; END IF;$new$
);
SELECT pg_temp.patch_fn(
  'public.set_content_file(uuid,uuid,integer,text,text,text,integer)',
  $old$IF _c.status <> 'draft' THEN RAISE EXCEPTION 'Submitted content cannot be edited'; END IF;$old$,
  $new$IF _c.status NOT IN ('draft','changes_requested') THEN RAISE EXCEPTION 'Submitted content cannot be edited'; END IF;$new$
);
SELECT pg_temp.patch_fn(
  'public.submit_content(uuid,integer)',
  $old$IF _c.status <> 'draft' THEN RAISE EXCEPTION 'Content is already submitted'; END IF;$old$,
  $new$IF _c.status NOT IN ('draft','changes_requested') THEN RAISE EXCEPTION 'Content is already submitted'; END IF;$new$
);

COMMIT;
