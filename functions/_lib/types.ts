export type OrgRole = "owner" | "editor" | "viewer";

export type StepType =
  | "llm_call"
  | "http_request"
  | "db_write"
  | "notify"
  | "conditional_branch"
  | "approval_gate";

export type TriggerType = "manual" | "webhook" | "scheduled" | "database_event";

export type RunStatus =
  | "pending"
  | "running"
  | "paused"
  | "succeeded"
  | "failed"
  | "cancelled";

export type StepRunStatus =
  | "pending"
  | "running"
  | "paused"
  | "succeeded"
  | "failed"
  | "skipped";

export interface WorkflowStepRow {
  id: string;
  workflow_id: string;
  org_id: string;
  step_order: number;
  type: StepType;
  name: string;
  config: Record<string, any>;
}

export interface StepRunRow {
  id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  org_id: string;
  step_order: number;
  type: StepType;
  status: StepRunStatus;
  input: any;
  output: any;
  error: string | null;
  attempt_count: number;
}
