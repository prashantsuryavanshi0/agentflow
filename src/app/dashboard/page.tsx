"use client";

import Link from "next/link";
import { useQuery } from "@apollo/client";
import { useOrg } from "@/lib/OrgContext";
import { GET_ORG_WORKFLOWS } from "@/lib/graphql/queries";
import StatusPill from "@/components/StatusPill";
import { STEP_TYPES } from "@/lib/types";

export default function Dashboard() {
  const { currentOrgId, currentMembership, loading: orgLoading, memberships } = useOrg();
  const { data, loading, error } = useQuery(GET_ORG_WORKFLOWS, {
    variables: { orgId: currentOrgId },
    skip: !currentOrgId,
    pollInterval: 10000,
  });

  if (!orgLoading && memberships.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-muted mb-4">You're not part of an organization yet.</p>
        <Link href="/dashboard/organizations/new" className="text-signal text-sm hover:underline">
          Create your first organization →
        </Link>
      </div>
    );
  }

  const canCreate = currentMembership && currentMembership.role !== "viewer";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-fg">Workflows</h1>
          <p className="text-sm text-muted mt-1">
            Scoped to <span className="text-fg">{currentMembership?.orgName}</span> — org + role permissions apply
            to everything below.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/workflows/new"
            className="rounded-lg bg-signal text-ink text-sm font-medium px-4 py-2 hover:brightness-110 transition"
          >
            + New workflow
          </Link>
        )}
      </div>

      {error && <p className="text-bad text-sm">{error.message}</p>}
      {loading && <p className="text-muted text-sm">Loading workflows…</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {data?.workflows?.map((wf: any) => (
          <Link
            key={wf.id}
            href={`/dashboard/workflows/${wf.id}`}
            className="rounded-xl border border-line bg-surface p-5 hover:border-signal/40 transition group"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display font-medium text-fg group-hover:text-signal transition">{wf.name}</h3>
              {wf.latest_run && <StatusPill status={wf.latest_run.status} />}
            </div>
            {wf.description && <p className="text-xs text-muted mt-1.5 line-clamp-2">{wf.description}</p>}

            <div className="flex flex-wrap gap-1.5 mt-4">
              {wf.steps.map((s: any) => (
                <span
                  key={s.id}
                  className="font-mono text-[10px] rounded border border-line bg-raised px-1.5 py-0.5 text-muted"
                >
                  {STEP_TYPES.find((t) => t.value === s.type)?.label ?? s.type}
                </span>
              ))}
              {wf.steps.length === 0 && <span className="text-[10px] text-muted italic">no steps yet</span>}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-line text-[11px] text-muted">
              <span>
                {wf.triggers.length} trigger{wf.triggers.length === 1 ? "" : "s"}
              </span>
              {wf.avg_run_duration_seconds != null && (
                <span className="font-mono">avg {Math.round(wf.avg_run_duration_seconds)}s</span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {!loading && data?.workflows?.length === 0 && (
        <div className="text-center py-16 border border-dashed border-line rounded-xl">
          <p className="text-muted text-sm">No workflows yet in this organization.</p>
        </div>
      )}
    </div>
  );
}
