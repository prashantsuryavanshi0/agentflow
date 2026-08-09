import type { Request, Response } from "express";
import { hasuraRequest } from "../_lib/hasura";
import { startRun } from "../_lib/runExecutor";

/**
 * Hit every minute by the Nhost cron trigger defined in
 * nhost/metadata/cron_triggers.yaml. Finds every `scheduled` trigger
 * whose next_run_at is due, starts a run for it, and reschedules it
 * from its cron expression.
 */
export default async function handler(req: Request, res: Response) {
  try {
    if (req.headers["x-agentflow-action-secret"] !== process.env.ACTION_SECRET) {
      return res.status(401).json({ message: "unauthorized" });
    }

    const due = await hasuraRequest<{
      workflow_triggers: { id: string; workflow_id: string; org_id: string; config: any }[];
    }>(
      `query Due($now: timestamptz!) {
        workflow_triggers(
          where: { type: { _eq: scheduled }, is_enabled: { _eq: true }, next_run_at: { _lte: $now } }
        ) { id workflow_id org_id config }
      }`,
      { now: new Date().toISOString() }
    );

    const results = [];
    for (const trigger of due.workflow_triggers) {
      const runId = await startRun(trigger.workflow_id, trigger.org_id, "scheduled", null);
      const next = computeNextRun(trigger.config?.cron || "*/5 * * * *");
      await hasuraRequest(
        `mutation Reschedule($id: uuid!, $next: timestamptz!) {
          update_workflow_triggers_by_pk(pk_columns: { id: $id }, _set: { next_run_at: $next }) { id }
        }`,
        { id: trigger.id, next }
      );
      results.push({ trigger_id: trigger.id, run_id: runId });
    }

    return res.status(200).json({ dispatched: results.length, results });
  } catch (err: any) {
    console.error("cron-run error", err);
    return res.status(500).json({ message: err?.message || "Internal error" });
  }
}

/**
 * Minimal cron-interval helper: only supports "every N minutes"
 * expressions of the form star-slash-N space star star star star
 * (e.g. every 5 minutes), which is enough for the assignment's
 * cron-based scheduling requirement without pulling in a full cron
 * parser. Falls back to 5 minutes for anything else.
 */
function computeNextRun(cron: string): string {
  const match = /^\*\/(\d+) \* \* \* \*$/.exec(cron.trim());
  const minutes = match ? parseInt(match[1], 10) : 5;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}