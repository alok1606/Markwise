REVOKE ALL ON public.contents FROM anon, authenticated;
REVOKE ALL ON public.content_versions FROM anon, authenticated;
GRANT SELECT ON public.contents TO authenticated;
GRANT SELECT ON public.content_versions TO authenticated;
REVOKE ALL ON public.content_versions FROM service_role;
GRANT SELECT, INSERT, DELETE ON public.content_versions TO service_role;
