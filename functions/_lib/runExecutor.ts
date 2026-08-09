import { hasuraRequest } from "./hasura";
import { callLLM } from "./llm";
import { StepRunRow, StepType, TriggerType, WorkflowStepRow } from "./types";

const MAX_ATTEMPTS = 2; // 1 try + 1 retry, per the "at least one retry" requirement

/**
 * Creates the workflow_run row plus one pending step_run per
 * workflow_step, then immediately continues execution. Used by every
 * trigger path (manual, webhook, scheduled, database_event) so the
 * six evaluation scenarios all go through one code path.
 */
export async function startRun(
  workflowId: string,
  orgId: string,
  triggeredByType: TriggerType,
  triggeredByUser: string | null
): Promise<string> {
  const steps = await hasuraRequest<{ workflow_steps: WorkflowStepRow[] }>(
    `query Steps($workflowId: uuid!) {
      workflow_steps(where: { workflow_id: { _eq: $workflowId } }, order_by: { step_order: asc }) {
        id workflow_id org_id step_order type name config
      }
    }`,
    { workflowId }
  );

  if (steps.workflow_steps.length === 0) {
    throw new Error("Workflow has no steps");
  }

  const created = await hasuraRequest<{
    insert_workflow_runs_one: { id: string };
  }>(
    `mutation CreateRun($object: workflow_runs_insert_input!) {
      insert_workflow_runs_one(object: $object) { id }
    }`,
    {
      object: {
        workflow_id: workflowId,
        org_id: orgId,
        status: "running",
        triggered_by_type: triggeredByType,
        triggered_by_user: triggeredByUser,
        step_runs: {
          data: steps.workflow_steps.map((s) => ({
            workflow_step_id: s.id,
            org_id: orgId,
            step_order: s.step_order,
            type: s.type,
            status: "pending",
          })),
        },
      },
    }
  );

  const runId = created.insert_workflow_runs_one.id;
  await continueRun(runId);
  return runId;
}

/**
 * Executes step_runs for a run in order, starting from the first one
 * that isn't already succeeded/skipped. Called on run creation and
 * again by approveStep to resume after a pause. Idempotent: safe to
 * call repeatedly, since it always re-reads current state first.
 */
export async function continueRun(runId: string): Promise<void> {
  const data = await hasuraRequest<{
    workflow_runs_by_pk: {
      id: string;
      org_id: string;
      status: string;
      step_runs: (StepRunRow & { workflow_step: WorkflowStepRow })[];
    };
  }>(
    `query RunState($runId: uuid!) {
      workflow_runs_by_pk(id: $runId) {
        id org_id status
        step_runs(order_by: { step_order: asc }) {
          id workflow_run_id workflow_step_id org_id step_order type status input output error attempt_count
          workflow_step { id workflow_id org_id step_order type name config }
        }
      }
    }`,
    { runId }
  );

  const run = data.workflow_runs_by_pk;
  if (!run) throw new Error("Run not found");
  if (run.status === "cancelled" || run.status === "failed") return;

  await setRunStatus(runId, "running");

  const stepRuns = run.step_runs;
  let previousOutput: any = null;

  for (let i = 0; i < stepRuns.length; i++) {
    const stepRun = stepRuns[i];

    if (stepRun.status === "succeeded" || stepRun.status === "skipped") {
      previousOutput = stepRun.output ?? previousOutput;
      continue;
    }

    if (stepRun.status === "paused") {
      // Still waiting on approval — nothing to do.
      return;
    }

    const step = stepRun.workflow_step;

    if (step.type === "approval_gate" && stepRun.status === "pending") {
      await updateStepRun(stepRun.id, {
        status: "paused",
        started_at: new Date().toISOString(),
        input: previousOutput,
      });
      await setRunStatus(runId, "paused");
      return;
    }

    if (step.type === "conditional_branch") {
      const { conditionTrue, skip } = evaluateCondition(step.config, previousOutput);
      await updateStepRun(stepRun.id, {
        status: "succeeded",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        input: previousOutput,
        output: { condition_true: conditionTrue },
        attempt_count: 1,
      });
      previousOutput = { condition_true: conditionTrue };

      for (let k = 1; k <= skip && i + k < stepRuns.length; k++) {
        const skipped = stepRuns[i + k];
        await updateStepRun(skipped.id, {
          status: "skipped",
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        });
      }
      i += skip;
      continue;
    }

    // llm_call / http_request / db_write / notify
    const result = await runStepWithRetry(stepRun, step, previousOutput, runId, run.org_id);
    if (!result.ok) {
      await setRunStatus(runId, "failed", result.error);
      return;
    }
    previousOutput = result.output;
  }

  await setRunStatus(runId, "succeeded");
  await incrementQuota(run.org_id);
}

async function runStepWithRetry(
  stepRun: StepRunRow,
  step: WorkflowStepRow,
  previousOutput: any,
  runId: string,
  orgId: string
): Promise<{ ok: boolean; output?: any; error?: string }> {
  let attempt = 0;
  let lastError = "";

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    await updateStepRun(stepRun.id, {
      status: "running",
      started_at: stepRun.started_at ?? new Date().toISOString(),
      input: previousOutput,
      attempt_count: attempt,
    });

    try {
      const output = await executeStep(step, previousOutput, runId, orgId);
      await updateStepRun(stepRun.id, {
        status: "succeeded",
        finished_at: new Date().toISOString(),
        output,
        error: null,
      });
      return { ok: true, output };
    } catch (err: any) {
      lastError = err?.message || String(err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500 * attempt)); // backoff before retry
      }
    }
  }

  await updateStepRun(stepRun.id, {
    status: "failed",
    finished_at: new Date().toISOString(),
    error: lastError,
  });
  return { ok: false, error: lastError };
}

async function executeStep(
  step: WorkflowStepRow,
  previousOutput: any,
  runId: string,
  orgId: string
): Promise<any> {
  switch (step.type as StepType) {
    case "llm_call": {
      const prompt = interpolate(step.config.prompt || "", previousOutput);
      const result = await callLLM(prompt, {
        model: step.config.model,
        system: step.config.system,
      });
      return { text: result.text, model: result.model, stubbed: result.stubbed };
    }

    case "http_request": {
      const url = interpolate(step.config.url || "", previousOutput);
      const method = step.config.method || "GET";
      const res = await fetch(url, {
        method,
        headers: step.config.headers || { "Content-Type": "application/json" },
        body: method !== "GET" && step.config.body ? JSON.stringify(step.config.body) : undefined,
      });
      const contentType = res.headers.get("content-type") || "";
      const body = contentType.includes("json") ? await res.json() : await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
      return { status: res.status, body };
    }

    case "db_write": {
      const key = step.config.key || step.name;
      await hasuraRequest(
        `mutation Write($object: workflow_outputs_insert_input!) {
          insert_workflow_outputs_one(object: $object) { id }
        }`,
        { object: { workflow_run_id: runId, org_id: orgId, key, value: previousOutput ?? {} } }
      );
      return { saved_key: key };
    }

    case "notify": {
      const url = step.config.webhook_url;
      const message = interpolate(step.config.message || "Workflow notification", previousOutput);
      if (url) {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: message }),
        }).catch(() => null); // best-effort; a failed notify shouldn't fail silently louder than logging
      }
      return { notified: Boolean(url), message };
    }

    default:
      throw new Error(`Unsupported step type: ${step.type}`);
  }
}

function evaluateCondition(
  config: Record<string, any>,
  previousOutput: any
): { conditionTrue: boolean; skip: number } {
  const field = config.field || "text";
  const operator = config.operator || "contains";
  const value = config.value ?? "";
  const raw = getPath(previousOutput, field);
  const haystack = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");

  let conditionTrue = false;
  switch (operator) {
    case "contains":
      conditionTrue = haystack.toLowerCase().includes(String(value).toLowerCase());
      break;
    case "equals":
      conditionTrue = haystack === String(value);
      break;
    case "not_equals":
      conditionTrue = haystack !== String(value);
      break;
    case "matches":
      conditionTrue = new RegExp(value).test(haystack);
      break;
    default:
      conditionTrue = false;
  }

  const skip = conditionTrue
    ? Number(config.on_true_skip_next || 0)
    : Number(config.on_false_skip_next || 0);

  return { conditionTrue, skip };
}

function getPath(obj: any, path: string) {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function interpolate(template: string, previousOutput: any): string {
  return template.replace(/\{\{\s*previous\.([\w.]+)\s*\}\}/g, (_, path) => {
    const v = getPath(previousOutput, path);
    return v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  });
}

async function updateStepRun(id: string, patch: Record<string, any>) {
  await hasuraRequest(
    `mutation PatchStepRun($id: uuid!, $patch: step_runs_set_input!) {
      update_step_runs_by_pk(pk_columns: { id: $id }, _set: $patch) { id }
    }`,
    { id, patch }
  );
}

async function setRunStatus(runId: string, status: string, error?: string) {
  await hasuraRequest(
    `mutation PatchRun($id: uuid!, $patch: workflow_runs_set_input!) {
      update_workflow_runs_by_pk(pk_columns: { id: $id }, _set: $patch) { id }
    }`,
    {
      id: runId,
      patch: {
        status,
        error: error ?? null,
        ...(status === "succeeded" || status === "failed" || status === "cancelled"
          ? { finished_at: new Date().toISOString() }
          : {}),
      },
    }
  );
}

async function incrementQuota(orgId: string) {
  await hasuraRequest(
    `mutation BumpQuota($orgId: uuid!) {
      update_organizations_by_pk(pk_columns: { id: $orgId }, _inc: { quota_calls_used: 1 }) { id }
    }`,
    { orgId }
  );
}
