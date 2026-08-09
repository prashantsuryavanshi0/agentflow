import type { Request, Response } from "express";
import { hasuraRequest } from "../_lib/hasura";
import { getMembership, canApprove } from "../_lib/permissions";
import { continueRun } from "../_lib/runExecutor";

/**
 * Hasura Action handler for `approveStep(step_run_id, approve)`.
 *
 * This is Layer 2 (step-level gating) made real: step_runs has NO
 * update permission for the `user` role (see tables.yaml), so the
 * only way to clear an approval_gate is through this handler, which
 * checks the approver's role itself before touching anything. A
 * database permission can't express this because it's a decision
 * about resuming an in-flight process, not a row-shape check.
 */
export default async function handler(req: Request, res: Response) {
  try {
    if (req.headers["x-agentflow-action-secret"] !== process.env.ACTION_SECRET) {
      return res.status(401).json({ message: "unauthorized" });
    }

    const sessionVariables = req.body.session_variables || {};
    const userId = sessionVariables["x-hasura-user-id"];
    const { step_run_id: stepRunId, approve, comment } = req.body.input || {};

    if (!userId) return res.status(401).json({ message: "Sign in required" });
    if (!stepRunId) return res.status(400).json({ message: "step_run_id is required" });

    const data = await hasuraRequest<{
      step_runs_by_pk: {
        id: string;
        org_id: string;
        status: string;
        type: string;
        workflow_run_id: string;
      } | null;
    }>(
      `query S($id: uuid!) {
        step_runs_by_pk(id: $id) { id org_id status type workflow_run_id }
      }`,
      { id: stepRunId }
    );

    const stepRun = data.step_runs_by_pk;
    if (!stepRun) return res.status(404).json({ message: "Step run not found" });
    if (stepRun.type !== "approval_gate") {
      return res.status(400).json({ message: "This step is not an approval gate" });
    }
    if (stepRun.status !== "paused") {
      return res.status(409).json({ message: `Step is not awaiting approval (status: ${stepRun.status})` });
    }

    const role = await getMembership(stepRun.org_id, userId);
    if (!canApprove(role)) {
      return res.status(403).json({ message: "Only an owner or editor in this org can approve this step" });
    }

    if (approve === false) {
      await hasuraRequest(
        `mutation RejectStep($id: uuid!, $userId: uuid!, $comment: String) {
          update_step_runs_by_pk(
            pk_columns: { id: $id }
            _set: { status: failed, approved_by: $userId, approved_at: "now()", error: $comment, finished_at: "now()" }
          ) { id }
        }`,
        { id: stepRunId, userId, comment: comment || "Rejected by approver" }
      );
      await hasuraRequest(
        `mutation RejectRun($runId: uuid!) {
          update_workflow_runs_by_pk(
            pk_columns: { id: $runId }
            _set: { status: failed, error: "Approval rejected", finished_at: "now()" }
          ) { id }
        }`,
        { runId: stepRun.workflow_run_id }
      );
      return res.status(200).json({ step_run_id: stepRunId, status: "failed", resumed: false });
    }

    await hasuraRequest(
      `mutation Approve($id: uuid!, $userId: uuid!) {
        update_step_runs_by_pk(
          pk_columns: { id: $id }
          _set: { status: succeeded, approved_by: $userId, approved_at: "now()", finished_at: "now()" }
        ) { id }
      }`,
      { id: stepRunId, userId }
    );

    await continueRun(stepRun.workflow_run_id);

    const finalRun = await hasuraRequest<{ workflow_runs_by_pk: { status: string } }>(
      `query FinalStatus($id: uuid!) { workflow_runs_by_pk(id: $id) { status } }`,
      { id: stepRun.workflow_run_id }
    );

    return res.status(200).json({
      step_run_id: stepRunId,
      status: finalRun.workflow_runs_by_pk.status,
      resumed: true,
    });
  } catch (err: any) {
    console.error("approveStep error", err);
    return res.status(500).json({ message: err?.message || "Internal error" });
  }
}
