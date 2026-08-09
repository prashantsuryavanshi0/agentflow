import type { Request, Response } from "express";
import { hasuraRequest } from "../_lib/hasura";
import { startRun } from "../_lib/runExecutor";

/**
 * Public inbound webhook endpoint — the "Webhook" trigger type.
 * URL shape: POST /webhook/inbound/:workflowId
 * Body: { "secret": "<per-trigger secret set when the trigger was created>" }
 *
 * No user session here (it's called by an external system), so
 * authorization comes entirely from the per-trigger secret stored in
 * workflow_triggers.config, which only an org owner could have
 * created (Layer 2 — see tables.yaml, workflow_triggers insert
 * permission).
 */
export default async function handler(req: Request, res: Response) {
  try {
    const workflowId = req.params?.workflowId || req.query?.workflowId;
    const providedSecret = req.body?.secret || req.headers["x-webhook-secret"];

    if (!workflowId) return res.status(400).json({ message: "workflowId is required" });

    const data = await hasuraRequest<{
      workflow_triggers: { id: string; org_id: string; config: any; is_enabled: boolean }[];
      workflows_by_pk: { org_id: string; is_active: boolean } | null;
    }>(
      `query T($workflowId: uuid!) {
        workflow_triggers(where: { workflow_id: { _eq: $workflowId }, type: { _eq: webhook } }, limit: 1) {
          id org_id config is_enabled
        }
        workflows_by_pk(id: $workflowId) { org_id is_active }
      }`,
      { workflowId }
    );

    const trigger = data.workflow_triggers[0];
    const workflow = data.workflows_by_pk;

    if (!trigger || !workflow) return res.status(404).json({ message: "No webhook trigger configured for this workflow" });
    if (!trigger.is_enabled || !workflow.is_active) return res.status(400).json({ message: "Trigger or workflow is disabled" });
    if (!providedSecret || providedSecret !== trigger.config?.secret) {
      return res.status(401).json({ message: "Invalid webhook secret" });
    }

    const runId = await startRun(workflowId, workflow.org_id, "webhook", null);
    return res.status(200).json({ run_id: runId, status: "accepted" });
  } catch (err: any) {
    console.error("webhook inbound error", err);
    return res.status(500).json({ message: err?.message || "Internal error" });
  }
}
