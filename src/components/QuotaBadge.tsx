"use client";

import { useOrg } from "@/lib/OrgContext";
import { useQuery } from "@apollo/client";
import { GET_ORG_USAGE } from "@/lib/graphql/queries";

export default function QuotaBadge() {
  const { currentOrgId } = useOrg();
  const { data } = useQuery(GET_ORG_USAGE, {
    variables: { orgId: currentOrgId },
    skip: !currentOrgId,
    pollInterval: 15000,
  });

  const usage = data?.org_usage_this_month?.[0];
  if (!usage) return null;

  const pct = Math.min(100, Math.round((usage.quota_calls_used / usage.quota_calls_allowed) * 100));
  const tone = pct >= 90 ? "bg-bad" : pct >= 70 ? "bg-warn" : "bg-good";

  return (
    <div className="hidden md:flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-1.5 text-xs text-muted">
      <span className="font-mono">
        {usage.quota_calls_used}/{usage.quota_calls_allowed}
      </span>
      <span className="w-16 h-1.5 rounded-full bg-line overflow-hidden">
        <span className={`block h-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
