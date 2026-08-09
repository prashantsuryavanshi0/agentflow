"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useOrg } from "@/lib/OrgContext";
import { CREATE_WORKFLOW } from "@/lib/graphql/mutations";

export default function NewWorkflow() {
  const { currentOrgId } = useOrg();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createWorkflow, { loading }] = useMutation(CREATE_WORKFLOW);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await createWorkflow({ variables: { orgId: currentOrgId, name, description } });
      router.replace(`/dashboard/workflows/${data.insert_workflows_one.id}`);
    } catch (err: any) {
      toast.error(err.message || "Could not create workflow");
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="font-display text-2xl font-semibold text-fg mb-1">New workflow</h1>
      <p className="text-sm text-muted mb-6">Add steps and a trigger on the next screen.</p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-muted">name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lead qualification"
            className="w-full rounded-lg bg-ink border border-line px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-signal/40"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-muted">description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-ink border border-line px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-signal/40"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-signal text-ink font-medium text-sm py-2.5 hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create workflow"}
        </button>
      </form>
    </div>
  );
}
