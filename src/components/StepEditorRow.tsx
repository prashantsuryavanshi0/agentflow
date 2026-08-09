"use client";

import { useState } from "react";
import { STEP_TYPES, type StepType } from "@/lib/types";

export interface DraftStep {
  id: string; // client-side temp id or real uuid
  isNew: boolean;
  step_order: number;
  type: StepType;
  name: string;
  config: Record<string, any>;
}

const CONFIG_HINT: Record<StepType, string> = {
  llm_call: '{ "prompt": "Classify: {{previous.body}}", "system": "Reply yes or no." }',
  http_request: '{ "url": "https://api.example.com/x", "method": "GET" }',
  db_write: '{ "key": "classification_result" }',
  notify: '{ "webhook_url": "https://hooks.slack.com/...", "message": "Run finished: {{previous.text}}" }',
  conditional_branch: '{ "field": "text", "operator": "contains", "value": "yes", "on_false_skip_next": 1 }',
  approval_gate: "{}",
};

export default function StepEditorRow({
  step,
  index,
  total,
  canEditRestricted,
  onChange,
  onRemove,
  onMove,
}: {
  step: DraftStep;
  index: number;
  total: number;
  canEditRestricted: boolean;
  onChange: (next: DraftStep) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [configText, setConfigText] = useState(JSON.stringify(step.config, null, 2));
  const [configError, setConfigError] = useState<string | null>(null);
  const meta = STEP_TYPES.find((t) => t.value === step.type)!;
  const locked = meta.restricted && !canEditRestricted;

  function commitConfig(text: string) {
    setConfigText(text);
    try {
      const parsed = text.trim() ? JSON.parse(text) : {};
      setConfigError(null);
      onChange({ ...step, config: parsed });
    } catch {
      setConfigError("Invalid JSON");
    }
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${locked ? "border-line/60 bg-raised/40" : "border-line bg-raised"}`}>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="text-muted hover:text-fg disabled:opacity-20 text-xs leading-none"
          >
            ▲
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="text-muted hover:text-fg disabled:opacity-20 text-xs leading-none"
          >
            ▼
          </button>
        </div>

        <span className="font-mono text-xs text-muted w-5">{index + 1}</span>

        <select
          value={step.type}
          disabled={locked}
          onChange={(e) => {
            const type = e.target.value as StepType;
            setConfigText(CONFIG_HINT[type]);
            onChange({ ...step, type, config: JSON.parse(CONFIG_HINT[type] || "{}") });
          }}
          className="rounded-md bg-ink border border-line px-2 py-1.5 text-xs font-mono text-fg disabled:opacity-50"
        >
          {STEP_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
              {t.restricted ? " (owner only)" : ""}
            </option>
          ))}
        </select>

        <input
          value={step.name}
          disabled={locked}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
          placeholder="step name"
          className="flex-1 rounded-md bg-ink border border-line px-2.5 py-1.5 text-xs text-fg disabled:opacity-50"
        />

        <button
          type="button"
          disabled={locked}
          onClick={onRemove}
          className="text-bad text-xs hover:brightness-125 disabled:opacity-30"
        >
          remove
        </button>
      </div>

      {locked && (
        <p className="text-[11px] text-warn">This step type can only be added or edited by an org owner.</p>
      )}

      {step.type !== "approval_gate" && (
        <div>
          <label className="text-[10px] font-mono text-muted">config (json)</label>
          <textarea
            value={configText}
            disabled={locked}
            onChange={(e) => commitConfig(e.target.value)}
            rows={3}
            spellCheck={false}
            className="w-full mt-1 rounded-md bg-ink border border-line px-2.5 py-2 text-[11px] font-mono text-fg disabled:opacity-50"
          />
          {configError && <p className="text-[10px] text-bad mt-1">{configError}</p>}
          <p className="text-[10px] text-muted mt-1">
            Use <code className="text-signal">{"{{previous.someField}}"}</code> to reference the prior step's output.
          </p>
        </div>
      )}
    </div>
  );
}
