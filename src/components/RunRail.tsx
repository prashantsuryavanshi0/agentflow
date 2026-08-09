"use client";

import { useMutation, useSubscription } from "@apollo/client";
import { useState } from "react";
import toast from "react-hot-toast";
import { STEP_RUNS_SUBSCRIPTION, WORKFLOW_RUN_SUBSCRIPTION } from "@/lib/graphql/subscriptions";
import { APPROVE_STEP } from "@/lib/graphql/mutations";
import StatusPill from "@/components/StatusPill";
import type { OrgRole } from "@/lib/types";

/**
 * The signature visual: a vertical "trace" connecting each step_run,
 * live from the step_runs subscription. The segment leading into the
 * currently-running node animates like current flowing down a
 * circuit; a paused approval_gate gets a pulsing amber halo instead
 * of a color, because that's the one state a person actually has to
 * act on.
 */
export default function RunRail({ runId, role }: { runId: string; role: OrgRole | null }) {
  const { data: runData } = useSubscription(WORKFLOW_RUN_SUBSCRIPTION, { variables: { runId } });
  const { data: stepData } = useSubscription(STEP_RUNS_SUBSCRIPTION, { variables: { runId } });
  const [approveStep, { loading: approving }] = useMutation(APPROVE_STEP);
  const [comment, setComment] = useState("");

  const run = runData?.workflow_runs_by_pk;
  const steps = stepData?.step_runs ?? [];
  const canApprove = role === "owner" || role === "editor";

  async function respond(stepRunId: string, approve: boolean) {
    try {
      await approveStep({ variables: { stepRunId, approve, comment: comment || null } });
      toast.success(approve ? "Approved — run resumed" : "Rejected — run stopped");
      setComment("");
    } catch (err: any) {
      toast.error(err.message || "Could not record decision");
    }
  }

  if (!run) return <p className="text-xs text-muted">Loading run…</p>;

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted">run</span>
          <span className="font-mono text-[11px] text-fg">{run.id.slice(0, 8)}</span>
        </div>
        <StatusPill status={run.status} />
      </div>

      {run.error && (
        <p className="mb-4 text-xs text-bad bg-bad/10 border border-bad/30 rounded-lg px-3 py-2">{run.error}</p>
      )}

      <ol className="space-y-0">
        {steps.map((s: any, idx: number) => {
          const isLast = idx === steps.length - 1;
          const connectorClass =
            s.status === "running" || s.status === "paused"
              ? "flow-connector"
              : s.status === "succeeded"
              ? "done-connector"
              : "idle-connector";

          return (
            <li key={s.id} className="relative pl-8">
              {!isLast && (
                <span className={`absolute left-[9px] top-6 w-0.5 h-full ${connectorClass}`} />
              )}
              <span
                className={`absolute left-0 top-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                  s.status === "paused"
                    ? "border-warn bg-warn/20 animate-ringPulse"
                    : s.status === "running"
                    ? "border-signal bg-signal/20"
                    : s.status === "succeeded"
                    ? "border-good bg-good/20"
                    : s.status === "failed"
                    ? "border-bad bg-bad/20"
                    : "border-line bg-raised"
                }`}
              >
                <span className="text-[9px] font-mono text-fg">{s.step_order + 1}</span>
              </span>

              <div className="pb-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-fg">{s.type}</span>
                  <StatusPill status={s.status} />
                  {s.attempt_count > 1 && (
                    <span className="text-[10px] font-mono text-muted">attempt {s.attempt_count}</span>
                  )}
                </div>

                {s.error && <p className="mt-1.5 text-xs text-bad">{s.error}</p>}

                {s.output && s.status === "succeeded" && (
                  <pre className="mt-1.5 text-[11px] font-mono text-muted bg-ink border border-line rounded-lg p-2 max-h-24 overflow-auto scrollbar-thin">
                    {JSON.stringify(s.output, null, 2)}
                  </pre>
                )}

                {s.type === "approval_gate" && s.status === "paused" && (
                  <div className="mt-2.5 rounded-lg border border-warn/40 bg-warn/5 p-3 space-y-2">
                    <p className="text-xs text-warn font-medium">Awaiting approval</p>
                    {canApprove ? (
                      <>
                        <input
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="optional comment"
                          className="w-full rounded-md bg-ink border border-line px-2.5 py-1.5 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-warn/50"
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={approving}
                            onClick={() => respond(s.id, true)}
                            className="text-xs px-3 py-1.5 rounded-md bg-good text-ink font-medium hover:brightness-110 transition disabled:opacity-50"
                          >
                            Approve & resume
                          </button>
                          <button
                            disabled={approving}
                            onClick={() => respond(s.id, false)}
                            className="text-xs px-3 py-1.5 rounded-md border border-bad/40 text-bad hover:bg-bad/10 transition disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted">Only an owner or editor in this org can approve.</p>
                    )}
                  </div>
                )}

                {s.approved_by && (
                  <p className="mt-1.5 text-[10px] font-mono text-muted">
                    resolved by {s.approved_by.slice(0, 8)} at {new Date(s.approved_at).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
