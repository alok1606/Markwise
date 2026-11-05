REVOKE ALL ON public.reviews, public.findings FROM anon, authenticated;
GRANT SELECT ON public.reviews, public.findings TO authenticated;