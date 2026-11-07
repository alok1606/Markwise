-- Migration 0019 (owner-approved 2026-11-07): Admin read-only review access.
-- No tables, grants, write policies, workflow functions or existing read policies are changed.

CREATE FUNCTION public.can_inspect_content_review(_content_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contents c
    WHERE c.id = _content_id AND c.deleted_at IS NULL
      AND public.is_workspace_member(c.workspace_id)
      AND public.has_role(auth.uid(), 'admin', c.workspace_id)
      AND EXISTS (SELECT 1 FROM public.reviews r WHERE r.content_id = c.id AND r.workspace_id = c.workspace_id)
  )
$$;
REVOKE ALL ON FUNCTION public.can_inspect_content_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_inspect_content_review(uuid) TO authenticated;

CREATE POLICY contents_admin_review_read ON public.contents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin', workspace_id) AND public.can_inspect_content_review(id));
CREATE POLICY content_versions_admin_review_read ON public.content_versions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin', workspace_id) AND public.can_inspect_content_review(content_id));
CREATE POLICY reviews_admin_review_read ON public.reviews FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin', workspace_id) AND public.can_inspect_content_review(content_id));
CREATE POLICY findings_admin_review_read ON public.findings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin', workspace_id) AND public.can_inspect_content_review(content_id));
CREATE POLICY approvals_admin_review_read ON public.approvals FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin', workspace_id) AND public.can_inspect_content_review(content_id));
CREATE POLICY finding_actions_admin_review_read ON public.finding_actions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin', workspace_id) AND public.can_inspect_content_review(content_id));
CREATE POLICY comments_admin_review_read ON public.comments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin', workspace_id) AND public.can_inspect_content_review(content_id));

-- Existing content-files SELECT policy delegates here. Only extend downloads,
-- never upload authorization; retain the path-to-workspace validation verbatim.
CREATE OR REPLACE FUNCTION public.can_read_content_file(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT split_part(_name, '/', 1) = (SELECT c.workspace_id::text FROM public.contents c WHERE c.id = public.content_file_content_id(_name))
    AND (public.can_read_content(public.content_file_content_id(_name))
      OR public.can_inspect_content_review(public.content_file_content_id(_name)))
$$;
