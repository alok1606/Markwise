CREATE TYPE public.content_type AS ENUM ('text','image','pdf');
CREATE TYPE public.content_status AS ENUM ('draft','submitted','in_review','approved','rejected','changes_requested');

CREATE TABLE public.contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  type public.content_type NOT NULL,
  channel text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT '',
  goal text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  file_path text,
  file_name text,
  file_mime text,
  file_size integer,
  alt_text text,
  text_color text,
  background_color text,
  status public.content_status NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  submitted_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contents_ws_status_idx ON public.contents (workspace_id, status) WHERE deleted_at IS NULL;
CREATE INDEX contents_owner_idx ON public.contents (owner_id, workspace_id);

CREATE TABLE public.content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.contents(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  title text NOT NULL,
  channel text NOT NULL,
  audience text NOT NULL,
  goal text NOT NULL,
  body_text text NOT NULL,
  file_path text,
  file_name text,
  file_mime text,
  file_size integer,
  alt_text text,
  text_color text,
  background_color text,
  changed_by uuid NOT NULL,
  change_summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, version_number)
);
CREATE INDEX content_versions_content_idx ON public.content_versions (content_id, version_number DESC);

-- Read-only from the Data API: every write goes through the functions below.
GRANT SELECT ON public.contents TO authenticated;
GRANT SELECT ON public.content_versions TO authenticated;
GRANT ALL ON public.contents TO service_role;
GRANT SELECT, INSERT ON public.content_versions TO service_role;
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_content(_content_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contents c
    WHERE c.id = _content_id AND c.deleted_at IS NULL AND (
      (c.owner_id = auth.uid() AND public.has_role(auth.uid(), 'creator', c.workspace_id))
      OR (c.status <> 'draft' AND public.has_role(auth.uid(), 'manager', c.workspace_id))
    ))
$$;
REVOKE ALL ON FUNCTION public.can_read_content(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_content(uuid) TO authenticated;

CREATE POLICY contents_read ON public.contents FOR SELECT TO authenticated USING (
  deleted_at IS NULL AND (
    (owner_id = auth.uid() AND public.has_role(auth.uid(), 'creator', workspace_id))
    OR (status <> 'draft' AND public.has_role(auth.uid(), 'manager', workspace_id))
  ));
CREATE POLICY content_versions_read ON public.content_versions FOR SELECT TO authenticated USING (public.can_read_content(content_id));

-- Versions are immutable for everyone, including privileged roles.
CREATE OR REPLACE FUNCTION public.content_versions_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Content versions are immutable'; END $$;
CREATE TRIGGER content_versions_no_update BEFORE UPDATE OR DELETE ON public.content_versions FOR EACH ROW EXECUTE FUNCTION public.content_versions_immutable();

-- Guard direct writes to contents (even privileged): no workspace/owner moves, no edits after submission.
CREATE OR REPLACE FUNCTION public.contents_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Content cannot be hard-deleted'; END IF;
  IF NEW.workspace_id <> OLD.workspace_id OR NEW.owner_id <> OLD.owner_id OR NEW.type <> OLD.type THEN RAISE EXCEPTION 'Workspace, owner and type cannot change'; END IF;
  IF OLD.status <> 'draft' AND current_setting('markwise.content_transition', true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'Submitted content cannot be edited'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER contents_guard BEFORE UPDATE OR DELETE ON public.contents FOR EACH ROW EXECUTE FUNCTION public.contents_guard();

CREATE OR REPLACE FUNCTION public.content_snapshot(_c public.contents, _actor uuid, _summary text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.content_versions (content_id, workspace_id, version_number, title, channel, audience, goal, body_text, file_path, file_name, file_mime, file_size, alt_text, text_color, background_color, changed_by, change_summary)
  VALUES (_c.id, _c.workspace_id, _c.version, _c.title, _c.channel, _c.audience, _c.goal, _c.body_text, _c.file_path, _c.file_name, _c.file_mime, _c.file_size, _c.alt_text, _c.text_color, _c.background_color, _actor, _summary);
$$;
REVOKE ALL ON FUNCTION public.content_snapshot(public.contents, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.content_audit(_ws uuid, _actor uuid, _action text, _id uuid, _meta jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_log (workspace_id, user_id, action, entity_type, entity_id, metadata) VALUES (_ws, _actor, _action, 'content', _id, _meta);
$$;
REVOKE ALL ON FUNCTION public.content_audit(uuid, uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.content_validate(_title text, _channel text, _audience text, _goal text, _body text, _alt text, _tc text, _bg text) RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF length(btrim(coalesce(_title,''))) = 0 OR length(_title) > 160 THEN RAISE EXCEPTION 'Title is required (max 160 characters)'; END IF;
  IF length(coalesce(_channel,'')) > 60 OR length(coalesce(_audience,'')) > 300 OR length(coalesce(_goal,'')) > 500 THEN RAISE EXCEPTION 'A field is too long'; END IF;
  IF length(coalesce(_body,'')) > 50000 THEN RAISE EXCEPTION 'Text is limited to 50,000 characters'; END IF;
  IF length(coalesce(_alt,'')) > 500 THEN RAISE EXCEPTION 'Alt text is limited to 500 characters'; END IF;
  IF _tc IS NOT NULL AND _tc !~ '^#[0-9A-F]{6}$' THEN RAISE EXCEPTION 'Use a six-digit HEX colour'; END IF;
  IF _bg IS NOT NULL AND _bg !~ '^#[0-9A-F]{6}$' THEN RAISE EXCEPTION 'Use a six-digit HEX colour'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_content(_workspace_id uuid, _type public.content_type, _title text, _channel text, _audience text, _goal text, _body_text text, _alt_text text, _text_color text, _background_color text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _row public.contents;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid, 'creator', _workspace_id) THEN RAISE EXCEPTION 'Only creators in this workspace can create content'; END IF;
  PERFORM public.content_validate(_title, _channel, _audience, _goal, _body_text, _alt_text, _text_color, _background_color);
  IF _type <> 'image' AND (_alt_text IS NOT NULL OR _text_color IS NOT NULL OR _background_color IS NOT NULL) THEN RAISE EXCEPTION 'Alt text and colours apply to images only'; END IF;
  IF _type <> 'text' AND length(coalesce(_body_text,'')) > 0 THEN RAISE EXCEPTION 'Upload the file first'; END IF;
  INSERT INTO public.contents (workspace_id, owner_id, title, type, channel, audience, goal, body_text, alt_text, text_color, background_color, version)
  VALUES (_workspace_id, _uid, btrim(_title), _type, coalesce(_channel,''), coalesce(_audience,''), coalesce(_goal,''), coalesce(_body_text,''), _alt_text, _text_color, _background_color, 1)
  RETURNING * INTO _row;
  PERFORM public.content_snapshot(_row, _uid, 'Created');
  PERFORM public.content_audit(_workspace_id, _uid, 'content_created', _row.id, jsonb_build_object('type', _type, 'version', 1));
  RETURN _row.id;
END $$;

-- Optimistic concurrency: caller passes the version it edited; the row is locked and the version is assigned here.
CREATE OR REPLACE FUNCTION public.save_content_draft(_content_id uuid, _expected_version integer, _title text, _channel text, _audience text, _goal text, _body_text text, _alt_text text, _text_color text, _background_color text, _pdf_text_confirmed boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.contents;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _uid OR NOT public.has_role(_uid, 'creator', _c.workspace_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'draft' THEN RAISE EXCEPTION 'Submitted content cannot be edited'; END IF;
  IF _c.version <> _expected_version THEN RAISE EXCEPTION 'This content changed since you opened it; reload and try again'; END IF;
  PERFORM public.content_validate(_title, _channel, _audience, _goal, _body_text, _alt_text, _text_color, _background_color);
  IF _c.type <> 'image' AND (_alt_text IS NOT NULL OR _text_color IS NOT NULL OR _background_color IS NOT NULL) THEN RAISE EXCEPTION 'Alt text and colours apply to images only'; END IF;
  IF _c.type = 'image' AND length(coalesce(_body_text,'')) > 0 THEN RAISE EXCEPTION 'Image content has no text body'; END IF;
  IF _c.type = 'pdf' AND coalesce(_body_text,'') <> _c.body_text AND NOT coalesce(_pdf_text_confirmed, false) THEN RAISE EXCEPTION 'Confirm the extracted PDF text before saving'; END IF;
  UPDATE public.contents SET title = btrim(_title), channel = coalesce(_channel,''), audience = coalesce(_audience,''), goal = coalesce(_goal,''), body_text = coalesce(_body_text,''),
    alt_text = _alt_text, text_color = _text_color, background_color = _background_color, version = _c.version + 1
  WHERE id = _content_id RETURNING * INTO _c;
  PERFORM public.content_snapshot(_c, _uid, 'Draft saved');
  PERFORM public.content_audit(_c.workspace_id, _uid, 'content_edited', _c.id, jsonb_build_object('version', _c.version));
  RETURN _c.version;
END $$;

CREATE OR REPLACE FUNCTION public.submit_content(_content_id uuid, _expected_version integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.contents;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _uid OR NOT public.has_role(_uid, 'creator', _c.workspace_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'draft' THEN RAISE EXCEPTION 'Content is already submitted'; END IF;
  IF _c.version <> _expected_version THEN RAISE EXCEPTION 'This content changed since you opened it; reload and try again'; END IF;
  IF _c.type <> 'text' AND _c.file_path IS NULL THEN RAISE EXCEPTION 'Upload a file before submitting'; END IF;
  IF _c.type = 'text' AND length(btrim(_c.body_text)) = 0 THEN RAISE EXCEPTION 'Add text before submitting'; END IF;
  IF _c.type = 'pdf' AND length(btrim(_c.body_text)) = 0 THEN RAISE EXCEPTION 'Confirm the extracted PDF text before submitting'; END IF;
  PERFORM set_config('markwise.content_transition', 'on', true);
  UPDATE public.contents SET status = 'submitted', submitted_at = now() WHERE id = _content_id;
  PERFORM set_config('markwise.content_transition', 'off', true);
  PERFORM public.content_audit(_c.workspace_id, _uid, 'content_submitted', _c.id, jsonb_build_object('version', _c.version));
END $$;

CREATE OR REPLACE FUNCTION public.delete_content_draft(_content_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.contents;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _uid OR NOT public.has_role(_uid, 'creator', _c.workspace_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'draft' THEN RAISE EXCEPTION 'Submitted content cannot be deleted'; END IF;
  UPDATE public.contents SET deleted_at = now() WHERE id = _content_id;
  PERFORM public.content_audit(_c.workspace_id, _uid, 'content_deleted', _c.id, jsonb_build_object('version', _c.version));
END $$;

-- Called only by the server after it has verified the stored file's real signature; rechecks the actor.
CREATE OR REPLACE FUNCTION public.set_content_file(_actor uuid, _content_id uuid, _expected_version integer, _file_path text, _file_name text, _file_mime text, _file_size integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.contents;
BEGIN
  SELECT * INTO _c FROM public.contents WHERE id = _content_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR _c.owner_id <> _actor OR NOT public.has_role(_actor, 'creator', _c.workspace_id) THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF _c.status <> 'draft' THEN RAISE EXCEPTION 'Submitted content cannot be edited'; END IF;
  IF _c.version <> _expected_version THEN RAISE EXCEPTION 'This content changed since you opened it; reload and try again'; END IF;
  IF _c.type = 'text' THEN RAISE EXCEPTION 'Text content has no file'; END IF;
  IF _file_path NOT LIKE _c.workspace_id::text || '/' || _c.id::text || '/%' THEN RAISE EXCEPTION 'Invalid file location'; END IF;
  -- A new PDF must have its text re-extracted and confirmed.
  UPDATE public.contents SET file_path = _file_path, file_name = left(_file_name, 200), file_mime = _file_mime, file_size = _file_size,
    body_text = CASE WHEN _c.type = 'pdf' THEN '' ELSE body_text END, version = _c.version + 1
  WHERE id = _content_id RETURNING * INTO _c;
  PERFORM public.content_snapshot(_c, _actor, 'File uploaded');
  PERFORM public.content_audit(_c.workspace_id, _actor, 'content_file_uploaded', _c.id, jsonb_build_object('version', _c.version, 'mime', _file_mime, 'size', _file_size));
  RETURN _c.version;
END $$;

REVOKE ALL ON FUNCTION public.create_content(uuid, public.content_type, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_content_draft(uuid, integer, text, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_content(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_content_draft(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_content_file(uuid, uuid, integer, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_content(uuid, public.content_type, text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_content_draft(uuid, integer, text, text, text, text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_content(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_content_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_content_file(uuid, uuid, integer, text, text, text, integer) TO service_role;

-- Storage: content-files/<workspace_id>/<content_id>/<uuid>.<ext>. Upload only into own draft; read by readers of the content; no update/delete (history keeps old files).
CREATE OR REPLACE FUNCTION public.content_file_content_id(_name text) RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF _name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$' THEN RETURN NULL; END IF;
  RETURN split_part(_name, '/', 2)::uuid;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.can_upload_content_file(_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.contents c WHERE c.id = public.content_file_content_id(_name)
    AND split_part(_name, '/', 1) = c.workspace_id::text AND c.owner_id = auth.uid() AND c.status = 'draft' AND c.deleted_at IS NULL AND c.type <> 'text'
    AND public.has_role(auth.uid(), 'creator', c.workspace_id))
$$;
CREATE OR REPLACE FUNCTION public.can_read_content_file(_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT split_part(_name, '/', 1) = (SELECT c.workspace_id::text FROM public.contents c WHERE c.id = public.content_file_content_id(_name))
    AND public.can_read_content(public.content_file_content_id(_name))
$$;
REVOKE ALL ON FUNCTION public.can_upload_content_file(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_content_file(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_upload_content_file(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_content_file(text) TO authenticated;

CREATE POLICY content_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'content-files' AND public.can_upload_content_file(name));
CREATE POLICY content_files_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'content-files' AND public.can_read_content_file(name));
