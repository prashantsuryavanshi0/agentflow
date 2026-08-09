import { gql } from "@apollo/client";

/** A subscription on step_runs (filtered to a workflow_run_id) for
 * live step-by-step progress, including a "paused, awaiting
 * approval" state. */
export const STEP_RUNS_SUBSCRIPTION = gql`
  subscription StepRunsForRun($runId: uuid!) {
    step_runs(where: { workflow_run_id: { _eq: $runId } }, order_by: { step_order: asc }) {
      id
      workflow_run_id
      workflow_step_id
      step_order
      type
      status
      input
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      finished_at
    }
  }
`;

export const WORKFLOW_RUN_SUBSCRIPTION = gql`
  subscription WorkflowRunStatus($runId: uuid!) {
    workflow_runs_by_pk(id: $runId) {
      id
      status
      error
      started_at
      finished_at
    }
  }
`;
