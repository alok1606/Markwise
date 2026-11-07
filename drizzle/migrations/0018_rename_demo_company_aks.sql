BEGIN;

-- Keep this as an append-only data migration. Only the dedicated fictional
-- Judge Demo workspace and rows explicitly marked as demo are in scope.
CREATE TEMP TABLE _markwise_aks_demo_workspaces (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _markwise_aks_demo_workspaces (id)
SELECT id
FROM public.workspaces
WHERE name = 'Judge Demo — Nimbus Onboard';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.glossary AS old_row
    JOIN public.glossary AS new_row
      ON new_row.workspace_id = old_row.workspace_id
     AND new_row.preferred_term = 'AKS Company'
     AND new_row.id <> old_row.id
    WHERE old_row.workspace_id IN (SELECT id FROM _markwise_aks_demo_workspaces)
      AND old_row.is_demo
      AND old_row.preferred_term = 'Nimbus Onboard'
  ) THEN
    RAISE EXCEPTION 'Cannot rename demo glossary term: AKS Company already exists in the Judge Demo workspace';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.palette AS old_row
    JOIN public.palette AS new_row
      ON new_row.workspace_id = old_row.workspace_id
     AND new_row.name = 'AKS Navy'
     AND new_row.id <> old_row.id
    WHERE old_row.workspace_id IN (SELECT id FROM _markwise_aks_demo_workspaces)
      AND old_row.is_demo
      AND old_row.name = 'Nimbus Navy'
  ) THEN
    RAISE EXCEPTION 'Cannot rename demo palette entry: AKS Navy already exists in the Judge Demo workspace';
  END IF;
END $$;

UPDATE public.workspaces
SET name = 'Judge Demo — AKS Company'
WHERE id IN (SELECT id FROM _markwise_aks_demo_workspaces);

UPDATE public.brand_profiles
SET brand_name = replace(brand_name, 'Nimbus Onboard', 'AKS Company'),
    description = replace(description, 'Nimbus Onboard', 'AKS Company'),
    website = replace(website, 'nimbus-onboard', 'aks-company'),
    mission = replace(mission, 'Nimbus Onboard', 'AKS Company'),
    positioning = replace(positioning, 'Nimbus Onboard', 'AKS Company')
WHERE workspace_id IN (SELECT id FROM _markwise_aks_demo_workspaces)
  AND is_demo
  AND (brand_name ILIKE '%Nimbus%' OR description ILIKE '%Nimbus%' OR website ILIKE '%nimbus%'
       OR mission ILIKE '%Nimbus%' OR positioning ILIKE '%Nimbus%');

-- Preserve the existing approved status while keeping an explicit prior
-- snapshot. The trigger is disabled only for this transaction so a name-only
-- migration does not invalidate demo fact approval or fabricate user action.
INSERT INTO public.fact_history (fact_id, workspace_id, version, change, snapshot, changed_by)
SELECT f.id, f.workspace_id, f.version, 'updated', to_jsonb(f), NULL
FROM public.facts AS f
WHERE f.workspace_id IN (SELECT id FROM _markwise_aks_demo_workspaces)
  AND f.is_demo
  AND (f.statement ILIKE '%Nimbus%' OR f.source_note ILIKE '%Nimbus%' OR f.evidence ILIKE '%Nimbus%');

ALTER TABLE public.facts DISABLE TRIGGER facts_versioning;
UPDATE public.facts
SET statement = replace(statement, 'Nimbus Onboard', 'AKS Company'),
    source_note = replace(source_note, 'Nimbus Onboard', 'AKS Company'),
    evidence = replace(evidence, 'Nimbus Onboard', 'AKS Company'),
    version = version + 1,
    updated_at = now()
WHERE workspace_id IN (SELECT id FROM _markwise_aks_demo_workspaces)
  AND is_demo
  AND (statement ILIKE '%Nimbus%' OR source_note ILIKE '%Nimbus%' OR evidence ILIKE '%Nimbus%');
ALTER TABLE public.facts ENABLE TRIGGER facts_versioning;

UPDATE public.glossary
SET preferred_term = replace(preferred_term, 'Nimbus Onboard', 'AKS Company'),
    avoided_terms = array_replace(array_replace(avoided_terms, 'Nimbus', 'AKS'), 'NimbusOnboard', 'AKSCompany'),
    note = replace(note, 'Nimbus Onboard', 'AKS Company'),
    usage_example = replace(usage_example, 'Nimbus Onboard', 'AKS Company'),
    spelling_note = replace(spelling_note, 'Nimbus Onboard', 'AKS Company'),
    updated_at = now()
WHERE workspace_id IN (SELECT id FROM _markwise_aks_demo_workspaces)
  AND is_demo
  AND (preferred_term ILIKE '%Nimbus%' OR 'Nimbus' = ANY(avoided_terms)
       OR 'NimbusOnboard' = ANY(avoided_terms) OR note ILIKE '%Nimbus%'
       OR usage_example ILIKE '%Nimbus%' OR spelling_note ILIKE '%Nimbus%');

UPDATE public.palette
SET name = replace(name, 'Nimbus', 'AKS'),
    usage_note = replace(usage_note, 'Nimbus Onboard', 'AKS Company'),
    updated_at = now()
WHERE workspace_id IN (SELECT id FROM _markwise_aks_demo_workspaces)
  AND is_demo
  AND (name ILIKE '%Nimbus%' OR usage_note ILIKE '%Nimbus%');

-- Future demo loads use the new company name. Permission checks, idempotency,
-- row scope, inserted examples, and audit behavior remain the same.
CREATE OR REPLACE FUNCTION public.load_demo_knowledge(_workspace_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin', _workspace_id) THEN RAISE EXCEPTION 'Only workspace administrators can load demo data'; END IF;
  INSERT INTO public.brand_profiles(workspace_id, brand_name, description, industry, website, target_audience, mission, positioning, is_demo, updated_by)
  VALUES (_workspace_id, 'AKS Company', 'Fictional demo data. AKS Company is an imaginary SaaS company that helps teams onboard new employees.', 'HR software (fictional)', 'https://example.com/aks-company', 'Fictional demo data: people-operations leads at growing companies.', 'Fictional demo data: make every first week calm and organised.', 'Fictional demo data: a calm, practical onboarding platform.', true, auth.uid())
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
    (_workspace_id, 'FACT-002', 'Founding year', 'AKS Company was founded in 2019.', 'Fictional demo data: company profile.', 'approved', true),
    (_workspace_id, 'FACT-003', 'Supported languages', 'Onboarding checklists are available in 6 languages.', 'Fictional demo data: product sheet.', 'approved', true),
    (_workspace_id, 'FACT-004', 'Setup time', 'A standard workspace can be set up in one day.', 'Fictional demo data: implementation guide.', 'approved', true)
  ON CONFLICT (workspace_id, code) DO NOTHING;
  INSERT INTO public.glossary(workspace_id, preferred_term, avoided_terms, note, is_demo) VALUES
    (_workspace_id, 'customers', ARRAY['clients'], 'Fictional demo data.', true),
    (_workspace_id, 'team members', ARRAY['employees','staff'], 'Fictional demo data.', true),
    (_workspace_id, 'sign in', ARRAY['log in','login'], 'Fictional demo data. Use as a verb.', true),
    (_workspace_id, 'AKS Company', ARRAY['AKS','AKSCompany'], 'Fictional demo data. Always use the full company name.', true)
  ON CONFLICT (workspace_id, preferred_term) DO NOTHING;
  INSERT INTO public.palette(workspace_id, name, hex, usage_note, is_demo) VALUES
    (_workspace_id, 'AKS Navy', '#1F2A44', 'Fictional demo data. Primary text and headers.', true),
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

COMMIT;
