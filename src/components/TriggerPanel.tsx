"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import toast from "react-hot-toast";
import { UPSERT_TRIGGER, DELETE_TRIGGER, CREATE_EVENT_SOURCE_ROW } from "@/lib/graphql/mutations";
import { TRIGGER_TYPES, type TriggerType, type OrgRole } from "@/lib/types";

export default function TriggerPanel({
  workflowId,
  orgId,
  triggers,
  role,
  onChanged,
}: {
  workflowId: string;
  orgId: string;
  triggers: any[];
  role: OrgRole | null;
  onChanged: () => void;
}) {
  const [upsertTrigger, { loading: saving }] = useMutation(UPSERT_TRIGGER);
  const [deleteTrigger] = useMutation(DELETE_TRIGGER);
  const [fireEvent] = useMutation(CREATE_EVENT_SOURCE_ROW);
  const [addingType, setAddingType] = useState<TriggerType | "">("");
  const [cron, setCron] = useState("*/5 * * * *");

  const canEdit = role === "owner" || role === "editor";
  const canWebhook = role === "owner";

  async function addTrigger(type: TriggerType) {
    if (type === "webhook" && !canWebhook) {
      toast.error("Only an owner can add a webhook trigger");
      return;
    }
    let config: Record<string, any> = {};
    if (type === "webhook") config = { secret: crypto.randomUUID().replace(/-/g, "") };
    if (type === "scheduled") config = { cron };

    try {
      await upsertTrigger({
        variables: {
          object: {
            workflow_id: workflowId,
            org_id: orgId,
            type,
            config,
            is_enabled: true,
            next_run_at: type === "scheduled" ? new Date(Date.now() + 5 * 60000).toISOString() : null,
          },
        },
      });
      toast.success(`${type} trigger added`);
      setAddingType("");
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Could not add trigger");
    }
  }

  async function remove(id: string) {
    try {
      await deleteTrigger({ variables: { id } });
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Could not remove trigger");
    }
  }

  async function simulateEvent(triggerId: string) {
    try {
      await fireEvent({ variables: { triggerId, orgId, payload: { simulated: true, at: new Date().toISOString() } } });
      toast.success("Event row inserted — Hasura Event Trigger should start a run momentarily");
    } catch (err: any) {
      toast.error(err.message || "Could not fire event");
    }
  }

  const existingTypes = new Set(triggers.map((t) => t.type));

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-medium text-fg">Triggers</h3>
        <span className="text-[10px] font-mono text-muted">manual is always available</span>
      </div>

      <div className="space-y-2">
        {triggers.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-line bg-raised px-3 py-2.5">
            <div>
              <p className="text-xs font-mono text-fg">{t.type}</p>
              {t.type === "webhook" && role === "owner" && (
                <p className="text-[10px] text-muted mt-1 break-all">
                  POST {"{NHOST_BACKEND_URL}"}/v1/functions/webhook/{workflowId} · {"{ \"secret\": \"...\" }"} in body
                </p>
              )}
              {t.type === "scheduled" && (
                <p className="text-[10px] text-muted mt-1">next run {t.next_run_at ? new Date(t.next_run_at).toLocaleTimeString() : "—"}</p>
              )}
              {t.type === "database_event" && <p className="text-[10px] text-muted mt-1">fires on insert into workflow_event_sources</p>}
            </div>
            <div className="flex items-center gap-2">
              {t.type === "database_event" && canEdit && (
                <button
                  onClick={() => simulateEvent(t.id)}
                  className="text-[10px] px-2 py-1 rounded-md border border-signal/40 text-signal hover:bg-signal/10 transition"
                >
                  simulate row insert
                </button>
              )}
              {canEdit && (t.type !== "webhook" || role === "owner") && (
                <button onClick={() => remove(t.id)} className="text-[10px] text-bad hover:brightness-125">
                  remove
                </button>
              )}
            </div>
          </div>
        ))}
        {triggers.length === 0 && <p className="text-xs text-muted italic">No triggers beyond manual yet.</p>}
      </div>

      {canEdit && (
        <div className="mt-4 pt-4 border-t border-line">
          <div className="flex flex-wrap gap-2">
            {TRIGGER_TYPES.filter((t) => t.value !== "manual" && !existingTypes.has(t.value)).map((t) => (
              <button
                key={t.value}
                disabled={t.restricted && !canWebhook}
                onClick={() => (t.value === "scheduled" ? setAddingType("scheduled") : addTrigger(t.value))}
                className="text-xs px-3 py-1.5 rounded-md border border-line text-muted hover:border-signal/40 hover:text-fg transition disabled:opacity-30"
                title={t.restricted && !canWebhook ? "Owner only" : undefined}
              >
                + {t.label}
              </button>
            ))}
          </div>
          {addingType === "scheduled" && (
            <div className="flex items-center gap-2 mt-3">
              <input
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                className="rounded-md bg-ink border border-line px-2.5 py-1.5 text-xs font-mono text-fg"
                placeholder="*/5 * * * *"
              />
              <button
                disabled={saving}
                onClick={() => addTrigger("scheduled")}
                className="text-xs px-3 py-1.5 rounded-md bg-signal text-ink font-medium hover:brightness-110 transition"
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
