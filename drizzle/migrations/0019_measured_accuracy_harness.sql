-- Round 3 Phase 1: workspace-scoped, Admin-readable measured evaluation records.
-- Evaluation inputs are a versioned fictional fixture pack; only server functions write results.
CREATE TABLE public.accuracy_evaluation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  dataset_version text NOT NULL,
  dataset_sha256 text NOT NULL CHECK (dataset_sha256 ~ '^[0-9a-f]{64}$'),
  evaluator_version text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  as_of_date date NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','partial','failed')),
  total_cases integer NOT NULL CHECK (total_cases >= 0),
  completed_cases integer NOT NULL DEFAULT 0 CHECK (completed_cases >= 0 AND completed_cases <= total_cases),
  ai_calls integer NOT NULL DEFAULT 0 CHECK (ai_calls >= 0 AND ai_calls <= 300),
  metrics jsonb,
  error_summary text,
  batch_lease_token uuid,
  lease_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, workspace_id)
);
CREATE UNIQUE INDEX accuracy_one_active_run_per_workspace
  ON public.accuracy_evaluation_runs(workspace_id)
  WHERE status IN ('queued','running');
CREATE INDEX accuracy_runs_workspace_created_idx
  ON public.accuracy_evaluation_runs(workspace_id, created_at DESC);

CREATE TABLE public.accuracy_evaluation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  case_key text NOT NULL,
  case_title text NOT NULL,
  input_text text NOT NULL,
  deterministic_status text NOT NULL CHECK (deterministic_status IN ('completed','failed')),
  ai_status text NOT NULL CHECK (ai_status IN ('completed','failed')),
  expected_deterministic jsonb NOT NULL,
  predicted_deterministic jsonb NOT NULL,
  expected_ai jsonb NOT NULL,
  predicted_ai jsonb,
  ai_error text,
  ai_call_count integer NOT NULL DEFAULT 0 CHECK (ai_call_count BETWEEN 0 AND 1),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, case_key),
  FOREIGN KEY (run_id, workspace_id) REFERENCES public.accuracy_evaluation_runs(id, workspace_id) ON DELETE CASCADE
);
CREATE INDEX accuracy_results_workspace_run_idx
  ON public.accuracy_evaluation_results(workspace_id, run_id, created_at);

ALTER TABLE public.accuracy_evaluation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accuracy_evaluation_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accuracy_evaluation_runs, public.accuracy_evaluation_results FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.accuracy_evaluation_runs, public.accuracy_evaluation_results TO authenticated;
GRANT ALL ON public.accuracy_evaluation_runs, public.accuracy_evaluation_results TO service_role;
CREATE POLICY accuracy_runs_admin_read ON public.accuracy_evaluation_runs
  FOR SELECT TO authenticated USING (
    public.is_workspace_member(workspace_id) AND public.has_role(auth.uid(), 'admin', workspace_id)
  );
CREATE POLICY accuracy_results_admin_read ON public.accuracy_evaluation_results
  FOR SELECT TO authenticated USING (
    public.is_workspace_member(workspace_id) AND public.has_role(auth.uid(), 'admin', workspace_id)
  );

CREATE FUNCTION public.accuracy_evaluation_run_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Accuracy evaluation runs are retained'; END IF;
  IF OLD.status IN ('completed','partial','failed') THEN RAISE EXCEPTION 'Completed accuracy evaluation runs are immutable'; END IF;
  IF NEW.workspace_id <> OLD.workspace_id OR NEW.requested_by <> OLD.requested_by
     OR NEW.dataset_version <> OLD.dataset_version OR NEW.dataset_sha256 <> OLD.dataset_sha256
     OR NEW.evaluator_version <> OLD.evaluator_version OR NEW.model <> OLD.model
     OR NEW.prompt_version <> OLD.prompt_version OR NEW.as_of_date <> OLD.as_of_date
     OR NEW.total_cases <> OLD.total_cases THEN
    RAISE EXCEPTION 'Accuracy evaluation inputs are immutable';
  END IF;
  IF NEW.ai_calls > 300 OR NEW.completed_cases > NEW.total_cases THEN RAISE EXCEPTION 'Accuracy evaluation cap exceeded'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER accuracy_runs_guard BEFORE UPDATE OR DELETE ON public.accuracy_evaluation_runs
  FOR EACH ROW EXECUTE FUNCTION public.accuracy_evaluation_run_guard();

CREATE FUNCTION public.accuracy_evaluation_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(workspace_id,user_id,action,entity_type,entity_id,metadata)
    VALUES (NEW.workspace_id,NEW.requested_by,'accuracy_evaluation.started','accuracy_evaluation_run',NEW.id,
      jsonb_build_object('dataset_version',NEW.dataset_version,'case_count',NEW.total_cases,'ai_call_cap',300));
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('completed','partial','failed') THEN
    INSERT INTO public.audit_log(workspace_id,user_id,action,entity_type,entity_id,metadata)
    VALUES (NEW.workspace_id,NEW.requested_by,'accuracy_evaluation.' || NEW.status,'accuracy_evaluation_run',NEW.id,
      jsonb_build_object('completed_cases',NEW.completed_cases,'ai_calls',NEW.ai_calls));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.accuracy_evaluation_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER accuracy_runs_audit AFTER INSERT OR UPDATE ON public.accuracy_evaluation_runs
  FOR EACH ROW EXECUTE FUNCTION public.accuracy_evaluation_audit();
