ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'checked';
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'pending_manager';
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'pending_reviewer';
COMMENT ON TYPE public.content_status IS 'in_review is DEPRECATED (never written since Phase 6). rejected is the terminal rejection decision.';