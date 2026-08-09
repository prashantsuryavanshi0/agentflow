"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CREATE_ORGANIZATION } from "@/lib/graphql/mutations";
import { GET_MY_ORGS } from "@/lib/graphql/queries";

export default function NewOrganization() {
  const [name, setName] = useState("");
  const [createOrganization, { loading }] = useMutation(CREATE_ORGANIZATION, {
    refetchQueries: [{ query: GET_MY_ORGS }],
  });
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createOrganization({ variables: { name } });
      toast.success(`Organization "${name}" created`);
      router.replace("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Could not create organization");
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="font-display text-2xl font-semibold text-fg mb-1">New organization</h1>
      <p className="text-sm text-muted mb-6">You'll become its owner automatically.</p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Corp"
          className="w-full rounded-lg bg-ink border border-line px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-signal/40"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-signal text-ink font-medium text-sm py-2.5 hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create organization"}
        </button>
      </form>
    </div>
  );
}
