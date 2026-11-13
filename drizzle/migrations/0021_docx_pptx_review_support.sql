BEGIN;

-- Extend only the existing content-file allowlist. DOCX/PPTX bytes are verified
-- by the server before registration; clients still cannot write content rows.
CREATE OR REPLACE FUNCTION public.set_content_file(
  _actor uuid, _content_id uuid, _expected_version integer,
  _file_path text, _file_name text, _file_mime text, _file_size integer
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.contents; _extension text; _max_size integer;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _actor IS NULL OR _c.owner_id IS DISTINCT FROM _actor
    OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _actor AND ur.role = 'creator' AND ur.workspace_id = _c.workspace_id)
  THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'draft' THEN RAISE EXCEPTION 'Submitted content cannot be edited'; END IF;
  IF _c.version IS DISTINCT FROM _expected_version THEN RAISE EXCEPTION 'This content changed since you opened it; reload and try again'; END IF;
  IF _c.type = 'text' THEN RAISE EXCEPTION 'Text content has no file'; END IF;

  _extension := CASE _c.type
    WHEN 'image' THEN CASE _file_mime WHEN 'image/png' THEN 'png' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/webp' THEN 'webp' ELSE NULL END
    WHEN 'pdf' THEN CASE WHEN _file_mime = 'application/pdf' THEN 'pdf' ELSE NULL END
    WHEN 'docx' THEN CASE WHEN _file_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' THEN 'docx' ELSE NULL END
    WHEN 'pptx' THEN CASE WHEN _file_mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation' THEN 'pptx' ELSE NULL END
  END;
  _max_size := CASE WHEN _c.type = 'image' THEN 10485760 ELSE 20971520 END;
  IF _extension IS NULL OR _file_name IS NULL OR _file_size IS NULL OR _file_size <= 0 OR _file_size > _max_size THEN RAISE EXCEPTION 'File type or size does not match this content'; END IF;
  IF _file_path IS NULL OR _file_path !~ ('^' || _c.workspace_id::text || '/' || _c.id::text || '/[0-9a-f-]{36}[.]' || _extension || '$') THEN RAISE EXCEPTION 'Invalid file location'; END IF;

  UPDATE public.contents SET file_path = _file_path, file_name = left(_file_name, 200), file_mime = _file_mime, file_size = _file_size,
    body_text = CASE WHEN _c.type IN ('pdf','docx','pptx') THEN '' ELSE body_text END, version = _c.version + 1
  WHERE id = _content_id RETURNING * INTO _c;
  PERFORM public.content_snapshot(_c, _actor, 'File uploaded');
  PERFORM public.content_audit(_c.workspace_id, _actor, 'content_file_uploaded', _c.id,
    jsonb_build_object('version', _c.version, 'mime', _file_mime, 'size', _file_size));
  RETURN _c.version;
END $$;

REVOKE ALL ON FUNCTION public.set_content_file(uuid, uuid, integer, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_content_file(uuid, uuid, integer, text, text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.content_file_content_id(_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF _name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp|pdf|docx|pptx)$' THEN RETURN NULL; END IF;
  RETURN split_part(_name, '/', 2)::uuid;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.content_file_content_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.content_file_content_id(text) TO authenticated, service_role;

-- The block map is version-scoped, read only through the same RLS-filtered
-- content_versions relation used by the existing creator/manager/reviewer/Admin views.
CREATE TABLE public.content_document_maps (
  content_version_id uuid PRIMARY KEY REFERENCES public.content_versions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  blocks jsonb NOT NULL CHECK (jsonb_typeof(blocks) = 'array' AND jsonb_array_length(blocks) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_document_maps_workspace_idx ON public.content_document_maps(workspace_id, content_version_id);
ALTER TABLE public.content_document_maps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_document_maps FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.content_document_maps TO authenticated;
CREATE POLICY content_document_maps_read ON public.content_document_maps
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.content_versions cv
      WHERE cv.id = content_document_maps.content_version_id
        AND cv.workspace_id = content_document_maps.workspace_id
    )
  );

CREATE FUNCTION public.content_document_map_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Document block maps are immutable';
END $$;
REVOKE ALL ON FUNCTION public.content_document_map_immutable() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER content_document_maps_no_update
  BEFORE UPDATE ON public.content_document_maps
  FOR EACH ROW EXECUTE FUNCTION public.content_document_map_immutable();

CREATE FUNCTION public.set_content_document_map(_actor uuid, _content_id uuid, _content_version_id uuid, _blocks jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _content public.contents; _version public.content_versions; _existing jsonb; _inserted integer;
BEGIN
  SELECT * INTO _content FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _actor IS NULL OR _content.owner_id IS DISTINCT FROM _actor
    OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _actor AND ur.role = 'creator' AND ur.workspace_id = _content.workspace_id)
    OR _content.type NOT IN ('docx','pptx')
  THEN RAISE EXCEPTION 'Document not found'; END IF;
  -- This function writes immutable location metadata for an existing version;
  -- it does not edit content or change workflow state.
  IF _content.status NOT IN ('draft','changes_requested','submitted','checked') THEN RAISE EXCEPTION 'This Office document cannot register text locations'; END IF;
  IF _blocks IS NULL OR jsonb_typeof(_blocks) <> 'array' OR jsonb_array_length(_blocks) > 2000 THEN RAISE EXCEPTION 'Invalid document block map'; END IF;
  SELECT * INTO _version FROM public.content_versions
    WHERE id = _content_version_id AND content_id = _content.id AND workspace_id = _content.workspace_id
      AND version_number = _content.version;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document block map does not match the current content version'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_blocks) AS entry
    WHERE jsonb_typeof(entry) IS DISTINCT FROM 'object'
       OR jsonb_typeof(entry->'text') IS DISTINCT FROM 'string'
       OR jsonb_typeof(entry->'location') IS DISTINCT FROM 'string'
       OR jsonb_typeof(entry->'kind') IS DISTINCT FROM 'string'
       OR jsonb_typeof(entry->'start') IS DISTINCT FROM 'number'
       OR jsonb_typeof(entry->'end') IS DISTINCT FROM 'number'
       OR (entry->>'start' ~ '^[0-9]+$') IS DISTINCT FROM true
       OR (entry->>'end' ~ '^[0-9]+$') IS DISTINCT FROM true
       OR (entry->>'start')::integer < 0
       OR (entry->>'end')::integer < (entry->>'start')::integer
       OR (entry->>'end')::integer > 100000
  ) THEN RAISE EXCEPTION 'Document block map contains invalid ranges'; END IF;

  INSERT INTO public.content_document_maps(content_version_id, workspace_id, blocks)
    VALUES (_content_version_id, _content.workspace_id, _blocks)
    ON CONFLICT (content_version_id) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  SELECT blocks INTO _existing FROM public.content_document_maps WHERE content_version_id = _content_version_id;
  IF _existing IS DISTINCT FROM _blocks THEN RAISE EXCEPTION 'A different block map is already registered for this version'; END IF;
  IF _inserted = 1 THEN
    PERFORM public.content_audit(_content.workspace_id, _actor, 'content_document_locations_saved', _content.id,
      jsonb_build_object('version', _content.version, 'block_count', jsonb_array_length(_blocks)));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_content_document_map(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_content_document_map(uuid, uuid, uuid, jsonb) TO service_role;

-- Extend the existing confirmation requirement to Office extractions. No content
-- status, review, AI, deterministic-check or approval transitions are changed.
CREATE OR REPLACE FUNCTION public.save_content_draft(
  _content_id uuid, _expected_version integer, _title text, _channel text, _audience text, _goal text,
  _body_text text, _alt_text text, _text_color text, _background_color text, _pdf_text_confirmed boolean
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.contents;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _uid OR NOT public.has_role(_uid, 'creator', _c.workspace_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'draft' THEN RAISE EXCEPTION 'Submitted content cannot be edited'; END IF;
  IF _c.version IS DISTINCT FROM _expected_version THEN RAISE EXCEPTION 'This content changed since you opened it; reload and try again'; END IF;
  PERFORM public.content_validate(_title, _channel, _audience, _goal, _body_text, _alt_text, _text_color, _background_color);
  IF _c.type <> 'image' AND (_alt_text IS NOT NULL OR _text_color IS NOT NULL OR _background_color IS NOT NULL) THEN RAISE EXCEPTION 'Alt text and colours apply to images only'; END IF;
  IF _c.type = 'image' AND length(coalesce(_body_text,'')) > 0 THEN RAISE EXCEPTION 'Image content has no text body'; END IF;
  IF _c.type IN ('pdf','docx','pptx') AND coalesce(_body_text,'') <> _c.body_text AND NOT coalesce(_pdf_text_confirmed, false) THEN
    RAISE EXCEPTION 'Confirm the extracted document text before saving';
  END IF;
  UPDATE public.contents SET title = btrim(_title), channel = coalesce(_channel,''), audience = coalesce(_audience,''), goal = coalesce(_goal,''), body_text = coalesce(_body_text,''),
    alt_text = _alt_text, text_color = _text_color, background_color = _background_color, version = _c.version + 1
  WHERE id = _content_id RETURNING * INTO _c;
  PERFORM public.content_snapshot(_c, _uid, 'Draft saved');
  PERFORM public.content_audit(_c.workspace_id, _uid, 'content_edited', _c.id, jsonb_build_object('version', _c.version));
  RETURN _c.version;
END $$;
REVOKE ALL ON FUNCTION public.save_content_draft(uuid, integer, text, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_content_draft(uuid, integer, text, text, text, text, text, text, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_content(_content_id uuid, _expected_version integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.contents;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _uid OR NOT public.has_role(_uid, 'creator', _c.workspace_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'draft' THEN RAISE EXCEPTION 'Content is already submitted'; END IF;
  IF _c.version IS DISTINCT FROM _expected_version THEN RAISE EXCEPTION 'This content changed since you opened it; reload and try again'; END IF;
  IF _c.type <> 'text' AND _c.file_path IS NULL THEN RAISE EXCEPTION 'Upload a file before submitting'; END IF;
  IF _c.type = 'text' AND length(btrim(_c.body_text)) = 0 THEN RAISE EXCEPTION 'Add text before submitting'; END IF;
  IF _c.type IN ('pdf','docx','pptx') AND length(btrim(_c.body_text)) = 0 THEN
    RAISE EXCEPTION 'Confirm the extracted document text before submitting';
  END IF;
  PERFORM set_config('markwise.content_transition', 'on', true);
  UPDATE public.contents SET status = 'submitted', submitted_at = now() WHERE id = _content_id;
  PERFORM set_config('markwise.content_transition', 'off', true);
  PERFORM public.content_audit(_c.workspace_id, _uid, 'content_submitted', _c.id, jsonb_build_object('version', _c.version));
END $$;
REVOKE ALL ON FUNCTION public.submit_content(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_content(uuid, integer) TO authenticated;

COMMIT;
