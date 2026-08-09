"use client";

import { useState } from "react";
import { useOrg } from "@/lib/OrgContext";
import Link from "next/link";

export default function OrgSwitcher() {
  const { memberships, currentOrgId, setCurrentOrgId } = useOrg();
  const [open, setOpen] = useState(false);
  const current = memberships.find((m) => m.orgId === currentOrgId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-1.5 text-xs text-fg hover:border-signal/40 transition"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-role" />
        {current?.orgName || "Select org"}
        <span className="text-muted">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-line bg-surface shadow-xl z-20 overflow-hidden">
            {memberships.map((m) => (
              <button
                key={m.orgId}
                onClick={() => {
                  setCurrentOrgId(m.orgId);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-xs flex items-center justify-between hover:bg-raised transition ${
                  m.orgId === currentOrgId ? "text-signal" : "text-fg"
                }`}
              >
                <span>{m.orgName}</span>
                <span className="text-muted uppercase tracking-wide">{m.role}</span>
              </button>
            ))}
            <Link
              href="/dashboard/organizations/new"
              className="block px-3 py-2.5 text-xs text-muted hover:text-signal border-t border-line transition"
              onClick={() => setOpen(false)}
            >
              + New organization
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
