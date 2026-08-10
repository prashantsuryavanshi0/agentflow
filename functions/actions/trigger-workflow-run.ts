import type { Request, Response } from "express";
import { hasuraRequest } from "../_lib/hasura";
import { getMembership, canTrigger } from "../_lib/permissions";
import { startRun } from "../_lib/runExecutor";
/**
 * Hasura Action handler for `triggerWorkflowRun(workflow_id)`.
 *
 * This is the core integration point the whole assignment hangs off:
 *   1. Verify the caller is owner/editor in the workflow's org.
 *   2. Check the org's quota isn't exhausted.
 *   3. Create the workflow_run + step_runs, then execute in order.
 *   4. llm_call/http_request steps make real calls, retried once.
 *   5. Hitting approval_gate pauses the run (see runExecutor).
 *   6. step_runs/workflow_run are updated throughout so the
 *      `step_runs` subscription reflects progress live.
 *   7. Quota is incremented on completion (see runExecutor).
 */
export default async function handler(req: Request, res: Response) {
  try {
    const sessionVariables = req.body.session_variables || {};
    const userId = sessionVariables["x-hasura-user-id"];
    const workflowId = req.body.input?.input?.workflow_id;
    if (!userId) return res.status(401).json({ message: "Sign in required" });
    if (!workflowId) return res.status(400).json({ message: "workflow_id is required" });
    const workflow = await hasuraRequest<{
      workflows_by_pk: { id: string; org_id: string; is_active: boolean } | null;
    }>(
      `query W($id: uuid!) { workflows_by_pk(id: $id) { id org_id is_active } }`,
      { id: workflowId }
    );
    if (!workflow.workflows_by_pk) {
      return res.status(404).json({ message: "Workflow not found" });
    }
    const { org_id: orgId, is_active: isActive } = workflow.workflows_by_pk;
    const role = await getMembership(orgId, userId);
    if (!canTrigger(role)) {
      return res.status(403).json({ message: "Only an owner or editor can trigger this workflow" });
    }
    if (!isActive) {
      return res.status(400).json({ message: "Workflow is disabled" });
    }
    const org = await hasuraRequest<{
      organizations_by_pk: { quota_calls_used: number; quota_calls_allowed: number };
    }>(
      `query Q($id: uuid!) { organizations_by_pk(id: $id) { quota_calls_used quota_calls_allowed } }`,
      { id: orgId }
    );
    const { quota_calls_used, quota_calls_allowed } = org.organizations_by_pk;
    if (quota_calls_used >= quota_calls_allowed) {
      return res.status(402).json({ message: "Organization usage quota is exhausted for this period" });
    }
    const runId = await startRun(workflowId, orgId, "manual", userId);
    const final = await hasuraRequest<{ workflow_runs_by_pk: { status: string } }>(
      `query S($id: uuid!) { workflow_runs_by_pk(id: $id) { status } }`,
      { id: runId }
    );
    return res.status(200).json({ run_id: runId, status: final.workflow_runs_by_pk.status });
  } catch (err: any) {
    console.error("triggerWorkflowRun error", err);
    return res.status(500).json({ message: err?.message || "Internal error" });
  }
}
