REVOKE ALL ON public.ai_calls FROM anon, authenticated;
GRANT SELECT ON public.ai_calls TO authenticated;
REVOKE ALL ON public.reviews, public.findings FROM anon, authenticated;
GRANT SELECT ON public.reviews, public.findings TO authenticated;