-- Office document types are added separately because PostgreSQL does not allow
-- a newly-added enum value to be used until the transaction has committed.
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'docx';
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'pptx';
