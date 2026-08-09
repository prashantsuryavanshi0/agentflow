# AgentFlow — Design Write-up

## Schema reasoning
The schema is a direct tenant tree: `organizations → org_members → workflows → {workflow_steps,
workflow_triggers} → workflow_runs → step_runs`. Every child table down to `step_runs` carries its own
`org_id` (denormalized from the workflow) rather than requiring a join through `workflows` to find it —
this is deliberate: it lets every permission filter and every Action-handler check be a single-hop
comparison against `org_members`, instead of a multi-hop join that's easy to get subtly wrong under
time pressure. `workflow_outputs` (what `db_write` steps write into) and `workflow_event_sources` (the
table a `database_event` trigger watches) are kept as first-class, narrow tables rather than letting a
step reach into arbitrary user tables — a workflow step should never be able to touch data outside its
own run, even when authored by an owner. Two aggregations satisfy the "Hasura layer" requirement:
`org_usage_this_month` as a Postgres view (join + `filter` aggregate on `workflow_runs`) and
`workflow_avg_run_duration_seconds` as a computed field backed by a SQL function, exposed directly on
`workflows` in GraphQL.

## How the two permission layers are enforced differently
**Layer 1 (org + role)** lives entirely in Hasura's declarative permission system
(`nhost/metadata/tables.yaml`). Every table's `select`/`insert`/`update`/`delete` filter is a relationship
expression that joins to `org_members` and compares `user_id` to `X-Hasura-User-Id` — role alone is
never sufficient, so the same `editor` role in two different orgs produces two structurally disjoint
row sets. This is why cross-org isolation holds even against direct ID guessing: a query for another
org's `workflow_id` doesn't get filtered *after* being read, it's never matched by the `where` clause in
the first place.

**Layer 2 (step-level gating)** is intentionally split in two. Its *declarative* half — only an owner
may add a `db_write`, `notify`, or webhook-trigger row — is expressible as a Hasura insert/update
`check`, so it lives there too (same file, same mechanism, just a row-shape condition instead of a pure
org check). Its *mid-execution* half — resolving a paused `approval_gate` — genuinely cannot be a
database permission: "is this step allowed to move from `paused` to `succeeded` right now" depends on
runtime state (is a run actually paused here, has it already been resolved, is a separate `workflow_run`
being updated in lockstep), not on the shape of the row being written. So `step_runs` has **no** update
permission for authenticated users at all, full stop — the only path to changing it is the `approveStep`
Hasura Action, which runs with the admin secret and re-derives the caller's org role itself
(`functions/_lib/permissions.ts`) before touching anything. That also means the Action is the actual
security boundary, not a UI convenience: even a crafted GraphQL request against the public endpoint
can't bypass it, because there is no permission granting the write it would need.

## Approval-gate pause/resume
`functions/_lib/runExecutor.ts` executes `step_runs` in `step_order`, re-reading current state on every
call rather than holding anything in memory — this is what makes pause/resume safe under a serverless
model with no persistent process. Hitting a pending `approval_gate` step marks that `step_run` and the
parent `workflow_run` `paused` and returns immediately; nothing polls or blocks. `approveStep` flips the
step to `succeeded` (or `failed`, if rejected) and then calls the exact same `continueRun(runId)` entry
point used at run start, which walks forward from the first non-terminal step it finds. Because every
step's status is persisted before the executor moves to the next one, `continueRun` is idempotent and
safe to call twice — a useful property if a client retries an approval click. The `step_runs`
subscription (`STEP_RUNS_SUBSCRIPTION`) means the pause and every subsequent state change is visible in
the UI the instant Postgres commits, with no polling on the frontend.
