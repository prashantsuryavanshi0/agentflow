export type OrgRole = "owner" | "editor" | "viewer";

export type StepType =
  | "llm_call"
  | "http_request"
  | "db_write"
  | "notify"
  | "conditional_branch"
  | "approval_gate";

export type TriggerType = "manual" | "webhook" | "scheduled" | "database_event";

export type RunStatus = "pending" | "running" | "paused" | "succeeded" | "failed" | "cancelled";

export type StepRunStatus = "pending" | "running" | "paused" | "succeeded" | "failed" | "skipped";

export const STEP_TYPES: { value: StepType; label: string; restricted?: boolean }[] = [
  { value: "llm_call", label: "LLM call" },
  { value: "http_request", label: "HTTP request" },
  { value: "db_write", label: "DB write", restricted: true },
  { value: "notify", label: "Notify", restricted: true },
  { value: "conditional_branch", label: "Conditional branch" },
  { value: "approval_gate", label: "Approval gate" },
];

export const TRIGGER_TYPES: { value: TriggerType; label: string; restricted?: boolean }[] = [
  { value: "manual", label: "Manual" },
  { value: "webhook", label: "Webhook", restricted: true },
  { value: "scheduled", label: "Scheduled" },
  { value: "database_event", label: "Database event" },
];
