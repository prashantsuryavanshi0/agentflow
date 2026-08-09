"use client";

import { useState } from "react";
import { useSignInEmailPassword, useAuthenticationStatus } from "@nhost/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signInEmailPassword, isLoading, isError, error } = useSignInEmailPassword();
  const { isAuthenticated } = useAuthenticationStatus();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await signInEmailPassword(email, password);
    if (result.isError) toast.error(result.error?.message || "Sign in failed");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-surface p-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-fg">Sign in</h1>
          <p className="text-sm text-muted mt-1">Access your organizations and workflows.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-muted">email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-ink border border-line px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-signal/40"
            placeholder="you@company.com"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-muted">password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-ink border border-line px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-signal/40"
            placeholder="••••••••"
          />
        </div>
        {isError && <p className="text-xs text-bad">{error?.message}</p>}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-signal text-ink font-medium text-sm py-2.5 hover:brightness-110 transition disabled:opacity-50"
        >
          {isLoading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-xs text-muted text-center">
          No account? <Link href="/sign-up" className="text-signal hover:underline">Create one</Link>
        </p>
      </form>
    </main>
  );
}
