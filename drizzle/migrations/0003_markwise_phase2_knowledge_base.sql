CREATE TYPE public.rule_category AS ENUM ('legal','claim','terminology','tone','visual','accessibility');
CREATE TYPE public.rule_severity AS ENUM ('critical','high','medium','low');
CREATE TYPE public.rule_type AS ENUM ('mandatory','prohibited','recommended');
CREATE TYPE public.rule_kind AS ENUM ('banned_term','required_phrase','tone_guidance','visual');
CREATE TYPE public.fact_status AS ENUM ('pending','approved','rejected','expired');

CREATE TABLE public.brand_profiles (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  brand_name text NOT NULL DEFAULT '' CHECK (length(brand_name) <= 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  industry text NOT NULL DEFAULT '' CHECK (length(industry) <= 120),
  website text NOT NULL DEFAULT '' CHECK (length(website) <= 300),
  target_audience text NOT NULL DEFAULT '' CHECK (length(target_audience) <= 2000),
  mission text NOT NULL DEFAULT '' CHECK (length(mission) <= 2000),
  positioning text NOT NULL DEFAULT '' CHECK (length(positioning) <= 2000),
  is_demo boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  file_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20971520),
  status text NOT NULL DEFAULT 'stored' CHECK (status IN ('stored','replaced')),
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'),
  category public.rule_category NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  severity public.rule_severity NOT NULL DEFAULT 'medium',
  rule_type public.rule_type NOT NULL DEFAULT 'mandatory',
  kind public.rule_kind NOT NULL DEFAULT 'banned_term',
  pattern jsonb NOT NULL DEFAULT '{}'::jsonb,
  examples text NOT NULL DEFAULT '' CHECK (length(examples) <= 2000),
  explanation text NOT NULL DEFAULT '' CHECK (length(explanation) <= 2000),
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, code)
);

CREATE TABLE public.rule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version integer NOT NULL,
  change text NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  statement text NOT NULL CHECK (length(trim(statement)) BETWEEN 1 AND 1000),
  source_note text NOT NULL DEFAULT '' CHECK (length(source_note) <= 1000),
  evidence text NOT NULL DEFAULT '' CHECK (length(evidence) <= 2000),
  status public.fact_status NOT NULL DEFAULT 'pending',
  valid_from date,
  valid_until date,
  approved_by uuid,
  approved_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, code),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE public.fact_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version integer NOT NULL,
  change text NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  preferred_term text NOT NULL CHECK (length(trim(preferred_term)) BETWEEN 1 AND 120),
  avoided_terms text[] NOT NULL DEFAULT '{}',
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  usage_example text NOT NULL DEFAULT '' CHECK (length(usage_example) <= 1000),
  case_sensitive boolean NOT NULL DEFAULT false,
  spelling_note text NOT NULL DEFAULT '' CHECK (length(spelling_note) <= 300),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, preferred_term)
);

CREATE TABLE public.palette (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  hex text NOT NULL CHECK (hex ~ '^#[0-9A-F]{6}$'),
  usage_note text NOT NULL DEFAULT '' CHECK (length(usage_note) <= 300),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE public.brand_fonts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  usage text NOT NULL DEFAULT '' CHECK (length(usage) <= 120),
  guidelines text NOT NULL DEFAULT '' CHECK (length(guidelines) <= 1000),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE public.brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  category text NOT NULL CHECK (category IN ('logo','image','icon','other')),
  file_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brand_documents_ws_idx ON public.brand_documents(workspace_id, created_at DESC);
CREATE INDEX rules_ws_idx ON public.rules(workspace_id, active);
CREATE INDEX rule_history_rule_idx ON public.rule_history(rule_id, version DESC);
CREATE INDEX rule_history_ws_idx ON public.rule_history(workspace_id);
CREATE INDEX facts_ws_idx ON public.facts(workspace_id, status);
CREATE INDEX fact_history_fact_idx ON public.fact_history(fact_id, version DESC);
CREATE INDEX fact_history_ws_idx ON public.fact_history(workspace_id);
CREATE INDEX glossary_ws_idx ON public.glossary(workspace_id);
CREATE INDEX palette_ws_idx ON public.palette(workspace_id);
CREATE INDEX brand_fonts_ws_idx ON public.brand_fonts(workspace_id);
CREATE INDEX brand_assets_ws_idx ON public.brand_assets(workspace_id, category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_profiles, public.brand_documents, public.rules, public.facts, public.glossary, public.palette, public.brand_fonts, public.brand_assets TO authenticated;
GRANT SELECT ON public.rule_history, public.fact_history TO authenticated;
GRANT ALL ON public.brand_profiles, public.brand_documents, public.rules, public.rule_history, public.facts, public.fact_history, public.glossary, public.palette, public.brand_fonts, public.brand_assets TO service_role;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['brand_profiles','brand_documents','rules','facts','glossary','palette','brand_fonts','brand_assets'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin'', workspace_id))', t || '_admin_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''admin'', workspace_id))', t || '_admin_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin'', workspace_id)) WITH CHECK (public.has_role(auth.uid(), ''admin'', workspace_id))', t || '_admin_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin'', workspace_id))', t || '_admin_delete', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['rule_history','fact_history'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin'', workspace_id))', t || '_admin_select', t);
  END LOOP;
END $$;

-- Keep workspace and ownership columns immutable and stamp timestamps.
CREATE OR REPLACE FUNCTION public.kb_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN RAISE EXCEPTION 'Records cannot move between workspaces'; END IF;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.rules_versioning()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1; NEW.created_by := auth.uid();
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN RAISE EXCEPTION 'Records cannot move between workspaces'; END IF;
    INSERT INTO public.rule_history(rule_id, workspace_id, version, change, snapshot, changed_by) VALUES (OLD.id, OLD.workspace_id, OLD.version, 'updated', to_jsonb(OLD), auth.uid());
    NEW.version := OLD.version + 1; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; NEW.updated_at := now();
    RETURN NEW;
  ELSE
    INSERT INTO public.rule_history(rule_id, workspace_id, version, change, snapshot, changed_by) VALUES (OLD.id, OLD.workspace_id, OLD.version, 'deleted', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.facts_versioning()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.fact_history(fact_id, workspace_id, version, change, snapshot, changed_by) VALUES (OLD.id, OLD.workspace_id, OLD.version, 'deleted', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1; NEW.created_by := auth.uid();
    IF NEW.status = 'approved' THEN NEW.approved_by := auth.uid(); NEW.approved_at := now(); ELSE NEW.approved_by := NULL; NEW.approved_at := NULL; END IF;
    RETURN NEW;
  END IF;
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN RAISE EXCEPTION 'Records cannot move between workspaces'; END IF;
  -- Changing the verified wording of an approved fact requires fresh human approval.
  IF OLD.status = 'approved' AND NEW.status = 'approved' AND (NEW.statement IS DISTINCT FROM OLD.statement OR NEW.source_note IS DISTINCT FROM OLD.source_note OR NEW.evidence IS DISTINCT FROM OLD.evidence) THEN
    NEW.status := 'pending';
  END IF;
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    NEW.approved_by := auth.uid(); NEW.approved_at := now();
  ELSIF NEW.status = 'approved' THEN
    NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
  ELSE
    NEW.approved_by := NULL; NEW.approved_at := NULL;
  END IF;
  INSERT INTO public.fact_history(fact_id, workspace_id, version, change, snapshot, changed_by) VALUES (OLD.id, OLD.workspace_id, OLD.version, 'updated', to_jsonb(OLD), auth.uid());
  NEW.version := OLD.version + 1; NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kb_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; ws uuid; eid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  r := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  ws := (r->>'workspace_id')::uuid;
  eid := coalesce((r->>'id')::uuid, ws);
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = ws) THEN RETURN NULL; END IF;
  INSERT INTO public.audit_log(workspace_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (ws, auth.uid(), TG_TABLE_NAME || '.' || lower(TG_OP), TG_TABLE_NAME, eid,
    jsonb_strip_nulls(jsonb_build_object('code', r->>'code', 'name', coalesce(r->>'name', r->>'preferred_term'), 'version', r->>'version', 'status', r->>'status')));
  RETURN NULL;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['brand_profiles','brand_documents','glossary','palette','brand_fonts','brand_assets'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.kb_before_write()', t || '_before_write', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['brand_profiles','brand_documents','rules','facts','glossary','palette','brand_fonts','brand_assets'] LOOP
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.kb_audit()', t || '_audit', t);
  END LOOP;
END $$;
CREATE TRIGGER rules_versioning BEFORE INSERT OR UPDATE OR DELETE ON public.rules FOR EACH ROW EXECUTE FUNCTION public.rules_versioning();
CREATE TRIGGER facts_versioning BEFORE INSERT OR UPDATE OR DELETE ON public.facts FOR EACH ROW EXECUTE FUNCTION public.facts_versioning();

REVOKE EXECUTE ON FUNCTION public.kb_audit(), public.rules_versioning(), public.facts_versioning(), public.kb_before_write() FROM PUBLIC, anon, authenticated;

-- Private storage: objects live under <workspace_id>/... and only that workspace's admins can touch them.
CREATE OR REPLACE FUNCTION public.kb_storage_workspace(_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN split_part(_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN split_part(_name, '/', 1)::uuid END
$$;
CREATE POLICY kb_files_admin_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('brand-documents','brand-assets') AND public.has_role(auth.uid(), 'admin', public.kb_storage_workspace(name)));
CREATE POLICY kb_files_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('brand-documents','brand-assets') AND public.has_role(auth.uid(), 'admin', public.kb_storage_workspace(name)));
CREATE POLICY kb_files_admin_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('brand-documents','brand-assets') AND public.has_role(auth.uid(), 'admin', public.kb_storage_workspace(name))) WITH CHECK (bucket_id IN ('brand-documents','brand-assets') AND public.has_role(auth.uid(), 'admin', public.kb_storage_workspace(name)));
CREATE POLICY kb_files_admin_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('brand-documents','brand-assets') AND public.has_role(auth.uid(), 'admin', public.kb_storage_workspace(name)));

-- Idempotent fictional demo data; removal touches only rows flagged is_demo.
CREATE OR REPLACE FUNCTION public.load_demo_knowledge(_workspace_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin', _workspace_id) THEN RAISE EXCEPTION 'Only workspace administrators can load demo data'; END IF;
  INSERT INTO public.brand_profiles(workspace_id, brand_name, description, industry, website, target_audience, mission, positioning, is_demo, updated_by)
  VALUES (_workspace_id, 'Nimbus Onboard', 'Fictional demo data. Nimbus Onboard is an imaginary SaaS company that helps teams onboard new employees.', 'HR software (fictional)', 'https://example.com/nimbus-onboard', 'Fictional demo data: people-operations leads at growing companies.', 'Fictional demo data: make every first week calm and organised.', 'Fictional demo data: a calm, practical onboarding platform.', true, auth.uid())
  ON CONFLICT (workspace_id) DO NOTHING;
  INSERT INTO public.rules(workspace_id, code, category, title, description, severity, rule_type, kind, pattern, explanation, is_demo) VALUES
    (_workspace_id, 'LEGAL-03', 'legal', 'Do not use "guaranteed"', 'Fictional demo data. Restricts the use of the word "guaranteed".', 'critical', 'prohibited', 'banned_term', '{"terms":["guaranteed"]}', 'Outcome guarantees create legal exposure.', true),
    (_workspace_id, 'LEGAL-01', 'legal', 'Do not promise "risk-free" results', 'Fictional demo data. Avoid "risk-free" and "no risk".', 'high', 'prohibited', 'banned_term', '{"terms":["risk-free","no risk"]}', '', true),
    (_workspace_id, 'CLAIM-01', 'claim', 'Numeric claims need an approved fact', 'Fictional demo data. Every percentage or statistic must match an approved fact.', 'high', 'mandatory', 'required_phrase', '{}', '', true),
    (_workspace_id, 'CLAIM-02', 'claim', 'Avoid unverifiable superlatives', 'Fictional demo data. Avoid "best-in-class" and "number one".', 'medium', 'prohibited', 'banned_term', '{"terms":["best-in-class","number one"]}', '', true),
    (_workspace_id, 'TERM-01', 'terminology', 'Say "customers", not "clients"', 'Fictional demo data. Use the glossary term "customers".', 'medium', 'mandatory', 'banned_term', '{"terms":["clients"]}', '', true),
    (_workspace_id, 'TONE-01', 'tone', 'Calm, practical tone', 'Fictional demo data. Prefer plain, calm sentences over hype.', 'low', 'recommended', 'tone_guidance', '{}', '', true),
    (_workspace_id, 'VISUAL-01', 'visual', 'Use the approved palette', 'Fictional demo data. Colours must be close to an approved palette colour.', 'medium', 'mandatory', 'visual', '{"max_delta_e":25}', '', true),
    (_workspace_id, 'A11Y-01', 'accessibility', 'Images need alt text and 4.5:1 contrast', 'Fictional demo data. All images need descriptive alt text; text needs at least 4.5:1 contrast.', 'high', 'mandatory', 'visual', '{"min_contrast":4.5}', '', true)
  ON CONFLICT (workspace_id, code) DO NOTHING;
  INSERT INTO public.facts(workspace_id, code, title, statement, source_note, status, is_demo) VALUES
    (_workspace_id, 'FACT-014', 'Onboarding time reduction', 'Reduces onboarding time by up to 40% (2025 customer study).', 'Fictional demo data: 2025 customer study.', 'approved', true),
    (_workspace_id, 'FACT-001', 'HR system integrations', 'Integrates with 12 HR systems.', 'Fictional demo data: product sheet.', 'approved', true),
    (_workspace_id, 'FACT-002', 'Founding year', 'Nimbus Onboard was founded in 2019.', 'Fictional demo data: company profile.', 'approved', true),
    (_workspace_id, 'FACT-003', 'Supported languages', 'Onboarding checklists are available in 6 languages.', 'Fictional demo data: product sheet.', 'approved', true),
    (_workspace_id, 'FACT-004', 'Setup time', 'A standard workspace can be set up in one day.', 'Fictional demo data: implementation guide.', 'approved', true)
  ON CONFLICT (workspace_id, code) DO NOTHING;
  INSERT INTO public.glossary(workspace_id, preferred_term, avoided_terms, note, is_demo) VALUES
    (_workspace_id, 'customers', ARRAY['clients'], 'Fictional demo data.', true),
    (_workspace_id, 'team members', ARRAY['employees','staff'], 'Fictional demo data.', true),
    (_workspace_id, 'sign in', ARRAY['log in','login'], 'Fictional demo data. Use as a verb.', true),
    (_workspace_id, 'Nimbus Onboard', ARRAY['Nimbus','NimbusOnboard'], 'Fictional demo data. Always use the full product name.', true)
  ON CONFLICT (workspace_id, preferred_term) DO NOTHING;
  INSERT INTO public.palette(workspace_id, name, hex, usage_note, is_demo) VALUES
    (_workspace_id, 'Nimbus Navy', '#1F2A44', 'Fictional demo data. Primary text and headers.', true),
    (_workspace_id, 'Slate', '#475569', 'Fictional demo data. Secondary text.', true),
    (_workspace_id, 'Cloud', '#F8FAFC', 'Fictional demo data. Backgrounds.', true),
    (_workspace_id, 'Signal Teal', '#0F766E', 'Fictional demo data. Accent and links.', true),
    (_workspace_id, 'Mist', '#CBD5E1', 'Fictional demo data. Borders and dividers.', true)
  ON CONFLICT (workspace_id, name) DO NOTHING;
  INSERT INTO public.brand_fonts(workspace_id, name, usage, guidelines, is_demo) VALUES
    (_workspace_id, 'Manrope', 'Headings and body', 'Fictional demo data. Use 600 weight for headings.', true)
  ON CONFLICT (workspace_id, name) DO NOTHING;
  INSERT INTO public.audit_log(workspace_id, user_id, action, entity_type, entity_id) VALUES (_workspace_id, auth.uid(), 'demo_knowledge.loaded', 'workspace', _workspace_id);
END $$;

CREATE OR REPLACE FUNCTION public.remove_demo_knowledge(_workspace_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin', _workspace_id) THEN RAISE EXCEPTION 'Only workspace administrators can remove demo data'; END IF;
  DELETE FROM public.rules WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.facts WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.glossary WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.palette WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.brand_fonts WHERE workspace_id = _workspace_id AND is_demo;
  DELETE FROM public.brand_profiles WHERE workspace_id = _workspace_id AND is_demo;
  INSERT INTO public.audit_log(workspace_id, user_id, action, entity_type, entity_id) VALUES (_workspace_id, auth.uid(), 'demo_knowledge.removed', 'workspace', _workspace_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.load_demo_knowledge(uuid), public.remove_demo_knowledge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.load_demo_knowledge(uuid), public.remove_demo_knowledge(uuid) TO authenticated;