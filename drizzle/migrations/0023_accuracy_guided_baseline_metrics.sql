BEGIN;

-- Extend the existing immutable-per-case result with the no-workspace-guidance
-- control pass. Nullable values keep results written by the earlier evaluator
-- readable and make their missing baseline explicit rather than fabricated.
ALTER TABLE public.accuracy_evaluation_results
  ADD COLUMN unguided_ai_status text CHECK (unguided_ai_status IN ('completed','failed')),
  ADD COLUMN predicted_ai_unguided jsonb,
  ADD COLUMN unguided_ai_error text;

ALTER TABLE public.accuracy_evaluation_results
  DROP CONSTRAINT IF EXISTS accuracy_evaluation_results_ai_call_count_check,
  ADD CONSTRAINT accuracy_evaluation_results_ai_call_count_check
    CHECK (ai_call_count BETWEEN 0 AND 2);

COMMIT;
