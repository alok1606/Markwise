-- Privileged purge path (service role only) for removing a whole workspace's content, e.g. test cleanup or workspace deletion.
CREATE OR REPLACE FUNCTION public.content_versions_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('markwise.content_purge', true) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Content versions are immutable';
END $$;
CREATE OR REPLACE FUNCTION public.contents_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('markwise.content_purge', true) = 'on' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Content cannot be hard-deleted';
  END IF;
  IF NEW.workspace_id <> OLD.workspace_id OR NEW.owner_id <> OLD.owner_id OR NEW.type <> OLD.type THEN RAISE EXCEPTION 'Workspace, owner and type cannot change'; END IF;
  IF OLD.status <> 'draft' AND current_setting('markwise.content_transition', true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'Submitted content cannot be edited'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.purge_workspace_content(_workspace_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('markwise.content_purge', 'on', true);
  DELETE FROM public.content_versions WHERE workspace_id = _workspace_id;
  DELETE FROM public.contents WHERE workspace_id = _workspace_id;
  PERFORM set_config('markwise.content_purge', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.purge_workspace_content(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_workspace_content(uuid) TO service_role;
