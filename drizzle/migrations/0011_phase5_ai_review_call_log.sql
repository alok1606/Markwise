DO $$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef('public.record_ai_review(uuid, uuid, uuid, jsonb, integer, integer, jsonb, text, text, text, text, uuid)'::regprocedure) INTO src;
  src := replace(src, '_file_sha256 text, _ai_call_id uuid)', '_file_sha256 text, _sent_summary text)');
  src := replace(src, $r$  IF _ai_call_id IS NOT NULL THEN
    INSERT INTO public.ai_calls (workspace_id, content_id, content_version_id, review_id, requested_by, provider, model, prompt_version, what_was_sent_summary, status)
    SELECT workspace_id, content_id, content_version_id, _rid, requested_by, provider, model, prompt_version, what_was_sent_summary, 'succeeded' FROM public.ai_calls WHERE id = _ai_call_id AND content_version_id = _v.id;
  END IF;$r$, $r$  INSERT INTO public.ai_calls (workspace_id, content_id, content_version_id, review_id, requested_by, provider, model, prompt_version, what_was_sent_summary, status)
  VALUES (_c.workspace_id, _c.id, _v.id, _rid, _actor, 'lovable-ai', left(_model,100), left(_prompt_version,40), left(coalesce(_sent_summary,''),500), 'succeeded');$r$);
  IF position('_sent_summary' in src) = 0 OR position('_ai_call_id' in src) > 0 THEN RAISE EXCEPTION 'rewrite failed'; END IF;
  DROP FUNCTION public.record_ai_review(uuid, uuid, uuid, jsonb, integer, integer, jsonb, text, text, text, text, uuid);
  EXECUTE src;
END $$;
REVOKE ALL ON FUNCTION public.record_ai_review(uuid, uuid, uuid, jsonb, integer, integer, jsonb, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_review(uuid, uuid, uuid, jsonb, integer, integer, jsonb, text, text, text, text, text) TO service_role;