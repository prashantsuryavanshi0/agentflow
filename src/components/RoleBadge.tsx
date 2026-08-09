import type { OrgRole } from "@/lib/types";

const styles: Record<OrgRole, string> = {
  owner: "text-role border-role/40 bg-role/10",
  editor: "text-signal border-signal/40 bg-signal/10",
  viewer: "text-muted border-line bg-raised",
};

export default function RoleBadge({ role }: { role: OrgRole }) {
  return (
    <span className={`font-mono text-[10px] uppercase tracking-wider rounded-full border px-2 py-1 ${styles[role]}`}>
      {role}
    </span>
  );
}
