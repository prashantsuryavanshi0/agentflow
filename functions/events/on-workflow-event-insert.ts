import type { Request, Response } from "express";
import { hasuraRequest } from "../_lib/hasura";
import { startRun } from "../_lib/runExecutor";

/**
 * Hasura Event Trigger handler for the "Database event" trigger
 * type. Fires whenever a row is inserted into workflow_event_sources
 * (our stand-in "watched table" — see nhost/metadata/tables.yaml).
 * A real deployment could point this at any table; the pattern is
 * identical.
 */
export default async function handler(req: Request, res: Response) {
  try {
    if (req.headers["x-agentflow-event-secret"] !== process.env.EVENT_TRIGGER_SECRET) {
      return res.status(401).json({ message: "unauthorized" });
    }

    const row = req.body?.event?.data?.new;
    if (!row) return res.status(200).json({ skipped: true });

    const trigger = await hasuraRequest<{
      workflow_triggers_by_pk: { id: string; workflow_id: string; org_id: string; is_enabled: boolean } | null;
    }>(
      `query Trig($id: uuid!) {
        workflow_triggers_by_pk(id: $id) { id workflow_id org_id is_enabled }
      }`,
      { id: row.workflow_trigger_id }
    );

    const t = trigger.workflow_triggers_by_pk;
    if (!t || !t.is_enabled) return res.status(200).json({ skipped: true });

    const runId = await startRun(t.workflow_id, t.org_id, "database_event", null);
    return res.status(200).json({ run_id: runId });
  } catch (err: any) {
    console.error("database event handler error", err);
    return res.status(500).json({ message: err?.message || "Internal error" });
  }
}
