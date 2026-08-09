"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthenticationStatus, useSignOut, useUserData } from "@nhost/nextjs";
import { OrgProvider, useOrg } from "@/lib/OrgContext";
import OrgSwitcher from "@/components/OrgSwitcher";
import QuotaBadge from "@/components/QuotaBadge";
import RoleBadge from "@/components/RoleBadge";

function Shell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const router = useRouter();
  const user = useUserData();
  const { signOut } = useSignOut();
  const { currentMembership, memberships, loading: orgsLoading } = useOrg();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/sign-in");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center text-muted text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="font-display font-semibold text-fg flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-signal animate-pulseTrace" />
            AgentFlow
          </Link>

          <div className="flex items-center gap-3">
            {!orgsLoading && memberships.length > 0 && <OrgSwitcher />}
            {currentMembership && <RoleBadge role={currentMembership.role} />}
            {currentMembership && <QuotaBadge />}
            <div className="h-6 w-px bg-line" />
            <span className="text-xs text-muted hidden sm:inline">{user?.displayName || user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-xs text-muted hover:text-fg border border-line rounded-md px-2.5 py-1.5 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <Shell>{children}</Shell>
    </OrgProvider>
  );
}
