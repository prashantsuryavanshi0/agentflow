"use client";

import { useState } from "react";
import { useSignUpEmailPassword, useAuthenticationStatus } from "@nhost/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const { signUpEmailPassword, isLoading, isError, error } = useSignUpEmailPassword();
  const { isAuthenticated } = useAuthenticationStatus();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await signUpEmailPassword(email, password, { displayName });
    if (result.isError) toast.error(result.error?.message || "Sign up failed");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-surface p-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-fg">Create account</h1>
          <p className="text-sm text-muted mt-1">You'll set up your first organization next.</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-muted">name</label>
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg bg-ink border border-line px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-signal/40"
            placeholder="Ada Lovelace"
          />
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
            minLength={8}
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
          {isLoading ? "Creating…" : "Create account"}
        </button>
        <p className="text-xs text-muted text-center">
          Already have one? <Link href="/sign-in" className="text-signal hover:underline">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
