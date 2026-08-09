# AgentFlow — AI Agent Workflow Builder

A minimal, purpose-built n8n for chaining AI agent steps, built on **nhost (Postgres + Hasura + Auth +
Functions) + Hasura GraphQL + PostgreSQL + Next.js**. Organizations own workflows; workflows are built
from typed steps and started by one of four trigger types; every action is checked against two
independent permission layers; execution streams live over a GraphQL subscription.

> Stack: nhost · Hasura · PostgreSQL · GraphQL (queries/mutations/subscriptions) · Next.js 14 (App
> Router) · TypeScript · Tailwind · Groq (free-tier LLM, with a disclosed stub fallback).

---

## 1. Architecture at a glance

```
Next.js (App Router)                Hasura                         Nhost Functions
┌─────────────────────┐   GraphQL   ┌────────────────────┐  admin  ┌───────────────────────────┐
│ workflow builder UI  │◄───────────►│ tables/views + RLS  │◄───────►│ triggerWorkflowRun         │
│ run rail (live sub)  │   queries   │ (Layer 1 permission │ secret  │ approveStep                │
│ approval UI          │   mutations │  filters)           │         │ createOrganization         │
│ org switcher / quota │   subs      │ Actions + Events +  │         │ webhook/[workflowId]       │
└─────────────────────┘             │ Cron triggers        │         │ events/on-...-insert       │
                                     └──────────┬──────────┘         │ scheduled/cron-run         │
                                                │                    │ _lib/runExecutor.ts (shared │
                                          Postgres                   │  step executor + retries)   │
                                     organizations, org_members,     └───────────────────────────┘
                                     workflows, workflow_steps,
                                     workflow_triggers, workflow_runs,
                                     step_runs, workflow_outputs,
                                     workflow_event_sources
```

Everything that **decides who can do what** lives in two places, by design:

- **Layer 1 (org + role scoping)** — Hasura permission filters in `nhost/metadata/tables.yaml`. Every
  table's filter joins through `org_members` to the caller's `X-Hasura-User-Id`, so role checks are
  always *also* org-scoped — an editor in Org A structurally cannot see Org B's rows, not even by ID.
- **Layer 2 (step-level gating)** — split across both layers on purpose:
  - The *declarative* half (only an owner may add a `db_write`, a webhook trigger, or a `notify` step)
    is a Hasura insert/update **check** expression, also in `tables.yaml`.
  - The *mid-execution* half (resolving a paused `approval_gate`) **cannot** be a database permission,
    because it's a decision about resuming a running process, not a row shape. `step_runs` has **no**
    update permission for authenticated users at all — the only way to move it out of `paused` is
    through the `approveStep` Action, which re-checks the approver's role itself
    (`functions/actions/approve-step.ts`).

## 2. Repo layout

```
nhost/
  nhost.toml                        # Nhost project config
  migrations/default/…/up.sql       # schema, enums, 2 aggregations (view + computed field)
  metadata/
    tables.yaml                     # tables, relationships, BOTH permission layers
    actions.yaml / actions.graphql  # triggerWorkflowRun, approveStep, createOrganization
    cron_triggers.yaml              # scheduled dispatcher
functions/                          # Nhost Serverless Functions (Node/TS, run with admin secret)
  _lib/                             # hasura client, run executor, llm client, permission helpers
  actions/                          # Action handlers
  webhook/[workflowId].ts           # inbound webhook trigger endpoint
  events/on-workflow-event-insert.ts# Hasura Event Trigger handler (database_event trigger type)
  scheduled/cron-run.ts             # cron trigger handler (scheduled trigger type)
src/                                # Next.js app
  app/                              # routes (sign-in/up, dashboard, workflow builder)
  components/                       # RunRail, StepEditorRow, TriggerPanel, OrgSwitcher, …
  lib/                              # nhost client, OrgContext, graphql queries/mutations/subs
WRITEUP.md                          # ~1 page design write-up (required deliverable)
```

## 3. Local setup

### Prerequisites
- Node 18+
- Docker (for the local Nhost/Hasura/Postgres stack)
- The [Nhost CLI](https://docs.nhost.io/reference/cli/installation): `npm i -g nhost`

### Steps

```bash
git clone <this-repo> && cd agentflow
cp .env.example .env.local          # fill in ACTION_SECRET, EVENT_TRIGGER_SECRET, GROQ_API_KEY (optional)
npm install

# 1. Start the local Nhost stack (Postgres + Hasura + Auth + Storage + Functions)
nhost up
# This applies nhost/migrations and nhost/metadata automatically, and serves
# functions/ at http://localhost:1337/v1/functions/...

# 2. Point the frontend at it (already the default in .env.example for `nhost up`)
# NEXT_PUBLIC_NHOST_SUBDOMAIN=localhost, NEXT_PUBLIC_NHOST_REGION=

# 3. Run the frontend
npm run dev
# → http://localhost:3000
```

### First-run walkthrough
1. Sign up two different browser profiles (or use incognito) as two different users — call them
   `owner-a@test.com` and `owner-b@test.com`.
2. Each creates their own organization from **+ New organization** (this calls the `createOrganization`
   Action, which inserts the org and makes the caller its `owner` atomically).
3. As Org A's owner, invite a second Org A user by having them sign up, then, as the owner, insert an
   `org_members` row for them via the Hasura Console (or extend the UI — a `POST /v1/graphql` mutation
   against `insert_org_members_one` also works, scoped by the same Layer-1 permission) with role
   `editor`.
4. Build a workflow (see §5, "Reproducing the final scenario").

### Deploying
- Push this repo, link it to an [Nhost Cloud](https://nhost.io) project (`nhost link`), then
  `nhost deploy` — this applies migrations/metadata and deploys the functions.
- Deploy `src/` (the Next.js app) to Vercel, setting `NEXT_PUBLIC_NHOST_SUBDOMAIN` /
  `NEXT_PUBLIC_NHOST_REGION` to your Nhost Cloud project's values.
- In the Nhost Cloud dashboard, set the **Secrets**: `HASURA_GRAPHQL_ADMIN_SECRET` (auto-generated),
  `ACTION_SECRET`, `EVENT_TRIGGER_SECRET`, `GROQ_API_KEY`, `APP_URL` (your Vercel URL).

### LLM provider
`llm_call` steps call Groq's free-tier, OpenAI-compatible endpoint
(`functions/_lib/llm.ts`). Get a free key at <https://console.groq.com>. **If `GROQ_API_KEY` is unset,
the step still runs — it returns a clearly-labelled `stubbed: true` response after a disclosed ~1.2s
artificial delay**, so the rest of the pipeline (retries, conditional branching, subscriptions) is fully
demonstrable without a key.

## 4. Data model

`organizations → org_members → workflows → {workflow_steps, workflow_triggers} → workflow_runs →
step_runs`, plus `workflow_outputs` (the sandbox `db_write` steps write into) and
`workflow_event_sources` (the "watched table" the `database_event` trigger listens on). Full DDL in
`nhost/migrations/default/1710000000000_init/up.sql`. Two aggregations, as required:
- `org_usage_this_month` — a Postgres **view** (calls used/allowed/remaining + run count this month).
- `workflow_avg_run_duration_seconds` — a **computed field** on `workflows`, backed by a SQL function.

## 5. Reproducing the final scenario

1. **Two orgs** — create Org A and Org B as different signed-up users (§3 first-run walkthrough).
2. **Org A workflow, 3+ step types** — as Org A's owner, create a workflow with steps, in order:
   1. `llm_call` — prompt e.g. `Does this support ticket sound urgent? Reply with exactly "yes" or
      "no". Ticket: {{previous.body}}` (first step, so `{{previous...}}` is empty — fine for a demo, or
      seed it via an `http_request` step before it).
   2. `http_request` — GET a public test API, e.g. `https://httpbin.org/json`.
   3. `conditional_branch` — `{ "field": "text", "operator": "contains", "value": "yes",
      "on_false_skip_next": 1 }` against the `llm_call` step's output, skipping the next step when the
      model says "no".
   3. **Two ways to start** — click **▶ Run** (manual), *and* separately add a **Webhook** trigger
      (owner only) and `POST` to it with the printed secret — or add a **Database event** trigger and
      click **simulate row insert** in the Triggers panel.
4. **Approval gate** — add an `approval_gate` step; running the workflow pauses there. Approving is
   only enabled in the UI for an owner/editor of that org (checked again inside `approveStep`).
5. **Live status** — the right-hand **Run Rail** is a `step_runs` GraphQL **subscription**: every state
   change (running → paused → succeeded/failed) appears without a page refresh.
6. **Cross-org isolation** — sign in as an Org B user and try to open Org A's workflow URL directly
   (`/dashboard/workflows/<org-a-workflow-id>`). The query returns nothing (Layer-1 filter), so the
   builder shows "Workflow not found, or you don't have access to it" — not a partial leak, not a 500.

## 6. GraphQL operations (see `src/lib/graphql/`)
- `GET_ORG_WORKFLOWS` — an org's workflows with steps, triggers, and `latest_run` status.
- `SAVE_WORKFLOW_STEPS` / `UPSERT_TRIGGER` — create/edit a workflow's steps and triggers.
- `APPROVE_STEP` — resolves a paused `approval_gate` step.
- `STEP_RUNS_SUBSCRIPTION` — live per-step progress for one `workflow_run_id`, including `paused`.

## 7. Known trade-offs (given the time box)
- `conditional_branch` implements a **linear skip** (skip N subsequent steps on true/false) rather than
  arbitrary DAG branching — enough to demonstrate output-dependent behavior without a full graph editor.
- The `scheduled` trigger's cron parsing only supports `*/N * * * *` (every N minutes) — swapping in a
  real cron library (e.g. `cron-parser`) is a drop-in change in `functions/scheduled/cron-run.ts`.
- `db_write` steps write into a dedicated `workflow_outputs` table rather than an arbitrary user table,
  intentionally — it keeps the sandbox closed even for an owner-authored step.
