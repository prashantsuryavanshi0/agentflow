const STATUS_STYLES: Record<string, string> = {
  pending: "text-muted border-line bg-raised",
  running: "text-signal border-signal/40 bg-signal/10",
  paused: "text-warn border-warn/40 bg-warn/10",
  succeeded: "text-good border-good/40 bg-good/10",
  failed: "text-bad border-bad/40 bg-bad/10",
  skipped: "text-muted border-line bg-raised line-through",
  cancelled: "text-muted border-line bg-raised",
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider rounded-full border px-2 py-1 ${
        STATUS_STYLES[status] || STATUS_STYLES.pending
      }`}
    >
      {(status === "running" || status === "paused") && (
        <span className={`h-1.5 w-1.5 rounded-full ${status === "running" ? "bg-signal" : "bg-warn"} animate-pulseTrace`} />
      )}
      {status}
    </span>
  );
}
