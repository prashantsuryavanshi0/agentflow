"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client";
import toast from "react-hot-toast";
import { GET_WORKFLOW } from "@/lib/graphql/queries";
import { SAVE_WORKFLOW_STEPS, TRIGGER_WORKFLOW_RUN } from "@/lib/graphql/mutations";
import { useOrg } from "@/lib/OrgContext";
import StepEditorRow, { DraftStep } from "@/components/StepEditorRow";
import TriggerPanel from "@/components/TriggerPanel";
import RunRail from "@/components/RunRail";
import StatusPill from "@/components/StatusPill";

export default function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>();
  const { currentMembership } = useOrg();
  const role = currentMembership?.role ?? null;
  const canEdit = role === "owner" || role === "editor";
  const canRun = role === "owner" || role === "editor";
  const canAddRestricted = role === "owner";

  const { data, loading, refetch } = useQuery(GET_WORKFLOW, { variables: { id }, pollInterval: 20000 });
  const [saveSteps, { loading: saving }] = useMutation(SAVE_WORKFLOW_STEPS);
  const [triggerRun, { loading: running }] = useMutation(TRIGGER_WORKFLOW_RUN);

  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data?.workflows_by_pk) return;
    const steps = data.workflows_by_pk.steps.map((s: any) => ({
      id: s.id,
      isNew: false,
      step_order: s.step_order,
      type: s.type,
      name: s.name,
      config: s.config,
    }));
    setDraftSteps(steps);
    setOriginalIds(steps.map((s: DraftStep) => s.id));
    setDirty(false);
    if (!selectedRunId && data.workflows_by_pk.runs?.[0]) {
      setSelectedRunId(data.workflows_by_pk.runs[0].id);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const workflow = data?.workflows_by_pk;

  function addStep() {
    setDraftSteps((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        isNew: true,
        step_order: prev.length,
        type: "llm_call",
        name: `Step ${prev.length + 1}`,
        config: { prompt: "" },
      },
    ]);
    setDirty(true);
  }

  function updateStep(idx: number, next: DraftStep) {
    setDraftSteps((prev) => prev.map((s, i) => (i === idx ? next : s)));
    setDirty(true);
  }

  function removeStep(idx: number) {
    setDraftSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i })));
    setDirty(true);
  }

  function moveStep(idx: number, dir: -1 | 1) {
    setDraftSteps((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, step_order: i }));
    });
    setDirty(true);
  }

  async function save() {
    if (!workflow) return;
    const currentIds = new Set(draftSteps.map((s) => s.id));
    const deleteIds = originalIds.filter((id) => !currentIds.has(id));
    try {
      await saveSteps({
        variables: {
          workflowId: workflow.id,
          orgId: workflow.org_id,
          deleteIds,
          steps: draftSteps.map((s) => ({
            id: s.id,
            workflow_id: workflow.id,
            org_id: workflow.org_id,
            step_order: s.step_order,
            type: s.type,
            name: s.name,
            config: s.config,
          })),
        },
      });
      toast.success("Workflow saved");
      setDirty(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Could not save — check step permissions");
    }
  }

  async function run() {
    try {
      const { data } = await triggerRun({ variables: { workflowId: workflow.id } });
      const runId = data.triggerWorkflowRun.run_id;
      setSelectedRunId(runId);
      toast.success("Run started");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Could not start run");
    }
  }

  if (loading && !workflow) return <p className="text-muted text-sm">Loading workflow…</p>;
  if (!workflow) return <p className="text-bad text-sm">Workflow not found, or you don't have access to it.</p>;

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-fg">{workflow.name}</h1>
            {workflow.description && <p className="text-sm text-muted mt-1">{workflow.description}</p>}
          </div>
          {canRun && (
            <button
              onClick={run}
              disabled={running || draftSteps.length === 0}
              className="shrink-0 rounded-lg bg-signal text-ink text-sm font-medium px-5 py-2.5 hover:brightness-110 transition disabled:opacity-40"
            >
              {running ? "Starting…" : "▶ Run"}
            </button>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-medium text-fg">Steps</h3>
            {canEdit && (
              <div className="flex items-center gap-2">
                {dirty && <span className="text-[10px] text-warn font-mono">unsaved changes</span>}
                <button onClick={addStep} className="text-xs px-2.5 py-1.5 rounded-md border border-line text-muted hover:text-fg hover:border-signal/40 transition">
                  + add step
                </button>
                <button
                  onClick={save}
                  disabled={saving || !dirty}
                  className="text-xs px-2.5 py-1.5 rounded-md bg-signal text-ink font-medium hover:brightness-110 transition disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {draftSteps.map((s, idx) => (
              <StepEditorRow
                key={s.id}
                step={s}
                index={idx}
                total={draftSteps.length}
                canEditRestricted={canAddRestricted}
                onChange={(next) => updateStep(idx, next)}
                onRemove={() => removeStep(idx)}
                onMove={(dir) => moveStep(idx, dir)}
              />
            ))}
            {draftSteps.length === 0 && <p className="text-xs text-muted italic">No steps yet — add one to get started.</p>}
          </div>
        </div>

        <TriggerPanel
          workflowId={workflow.id}
          orgId={workflow.org_id}
          triggers={workflow.triggers}
          role={role}
          onChanged={refetch}
        />
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="font-display text-sm font-medium text-fg mb-2">Recent runs</h3>
          <div className="space-y-1.5">
            {workflow.runs.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setSelectedRunId(r.id)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                  selectedRunId === r.id ? "border-signal/50 bg-signal/5" : "border-line bg-surface hover:border-line/80"
                }`}
              >
                <span className="text-[11px] font-mono text-muted">
                  {r.id.slice(0, 8)} · {r.triggered_by_type}
                </span>
                <StatusPill status={r.status} />
              </button>
            ))}
            {workflow.runs.length === 0 && <p className="text-xs text-muted italic">No runs yet.</p>}
          </div>
        </div>

        {selectedRunId && <RunRail runId={selectedRunId} role={role} />}
      </div>
    </div>
  );
}
