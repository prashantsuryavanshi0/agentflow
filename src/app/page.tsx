"use client";

import { useAuthenticationStatus } from "@nhost/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isLoading, isAuthenticated, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-xl w-full text-center space-y-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-mono text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulseTrace" />
          nhost · hasura · postgres · graphql
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-fg">
          Chain AI agent steps.
          <br />
          <span className="text-muted">Gate every action twice.</span>
        </h1>
        <p className="text-muted text-sm sm:text-base leading-relaxed max-w-md mx-auto">
          AgentFlow is a minimal, purpose-built n8n for AI workflows: llm_call, http_request,
          conditional branching, and human approval gates — scoped to your organization, streamed
          live step by step.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/sign-in"
            className="px-5 py-2.5 rounded-lg bg-signal text-ink font-medium text-sm hover:brightness-110 transition"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="px-5 py-2.5 rounded-lg border border-line text-fg font-medium text-sm hover:border-signal/50 transition"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
