"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { GET_MY_ORGS } from "@/lib/graphql/queries";
import type { OrgRole } from "@/lib/types";

interface OrgMembership {
  orgId: string;
  orgName: string;
  role: OrgRole;
  quotaUsed: number;
  quotaAllowed: number;
}

interface OrgContextValue {
  memberships: OrgMembership[];
  currentOrgId: string | null;
  currentMembership: OrgMembership | null;
  setCurrentOrgId: (id: string) => void;
  loading: boolean;
  refetch: () => void;
}

const OrgContext = createContext<OrgContextValue | null>(null);

const STORAGE_KEY = "agentflow.currentOrgId";

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, refetch } = useQuery(GET_MY_ORGS, { fetchPolicy: "cache-and-network" });
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);

  const memberships: OrgMembership[] = useMemo(
    () =>
      (data?.org_members ?? []).map((m: any) => ({
        orgId: m.organization.id,
        orgName: m.organization.name,
        role: m.role,
        quotaUsed: m.organization.quota_calls_used,
        quotaAllowed: m.organization.quota_calls_allowed,
      })),
    [data]
  );

  useEffect(() => {
    if (currentOrgId || memberships.length === 0) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const valid = stored && memberships.some((m) => m.orgId === stored);
    setCurrentOrgIdState(valid ? stored! : memberships[0].orgId);
  }, [memberships, currentOrgId]);

  function setCurrentOrgId(id: string) {
    setCurrentOrgIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }

  const currentMembership = memberships.find((m) => m.orgId === currentOrgId) ?? null;

  return (
    <OrgContext.Provider value={{ memberships, currentOrgId, currentMembership, setCurrentOrgId, loading, refetch }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside OrgProvider");
  return ctx;
}
