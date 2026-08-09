-- =====================================================================
-- AgentFlow — AI Agent Workflow Builder
-- Core schema: orgs, membership, workflows, steps, triggers, runs
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.org_role as enum ('owner', 'editor', 'viewer');

create type public.step_type as enum (
  'llm_call',
  'http_request',
  'db_write',
  'notify',
  'conditional_branch',
  'approval_gate'
);

create type public.trigger_type as enum (
  'manual',
  'webhook',
  'scheduled',
  'database_event'
);

create type public.run_status as enum (
  'pending',
  'running',
  'paused',
  'succeeded',
  'failed',
  'cancelled'
);

create type public.step_run_status as enum (
  'pending',
  'running',
  'paused',
  'succeeded',
  'failed',
  'skipped'
);

-- ---------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quota_period_start date not null default date_trunc('month', now())::date,
  quota_calls_allowed integer not null default 1000,
  quota_calls_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is 'Tenant boundary. Every permission check ultimately scopes to one row here.';

-- ---------------------------------------------------------------------
-- org_members — join of auth.users <-> organizations with a role
-- ---------------------------------------------------------------------
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index idx_org_members_user on public.org_members(user_id);
create index idx_org_members_org on public.org_members(org_id);

-- ---------------------------------------------------------------------
-- workflows
-- ---------------------------------------------------------------------
create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workflows_org on public.workflows(org_id);

-- ---------------------------------------------------------------------
-- workflow_steps — ordered nodes of a workflow
-- ---------------------------------------------------------------------
create table public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  step_order integer not null,
  type public.step_type not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workflow_id, step_order)
);

create index idx_workflow_steps_workflow on public.workflow_steps(workflow_id);

-- ---------------------------------------------------------------------
-- workflow_triggers
-- ---------------------------------------------------------------------
create table public.workflow_triggers (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  type public.trigger_type not null,
  -- manual: {}   webhook: {"secret": "..."}   scheduled: {"cron": "*/5 * * * *", "next_run_at": "..."}
  -- database_event: {"watch_table": "leads", "watch_schema": "public"}
  config jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  next_run_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_workflow_triggers_workflow on public.workflow_triggers(workflow_id);
create index idx_workflow_triggers_due on public.workflow_triggers(next_run_at) where type = 'scheduled';

-- ---------------------------------------------------------------------
-- workflow_runs — one per execution
-- ---------------------------------------------------------------------
create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  status public.run_status not null default 'pending',
  triggered_by_type public.trigger_type not null default 'manual',
  triggered_by_user uuid references auth.users(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index idx_workflow_runs_workflow on public.workflow_runs(workflow_id);
create index idx_workflow_runs_org on public.workflow_runs(org_id);

-- ---------------------------------------------------------------------
-- step_runs — one per step per run
-- ---------------------------------------------------------------------
create table public.step_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  step_order integer not null,
  type public.step_type not null,
  status public.step_run_status not null default 'pending',
  input jsonb,
  output jsonb,
  error text,
  attempt_count integer not null default 0,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_step_runs_run on public.step_runs(workflow_run_id);
create index idx_step_runs_org on public.step_runs(org_id);

-- ---------------------------------------------------------------------
-- database_event source table — a simple table that, when a row is
-- inserted, can drive a `database_event` trigger via a Hasura Event
-- Trigger. Each row references the workflow it should start.
-- ---------------------------------------------------------------------
create table public.workflow_event_sources (
  id uuid primary key default gen_random_uuid(),
  workflow_trigger_id uuid not null references public.workflow_triggers(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_workflow_event_sources_trigger on public.workflow_event_sources(workflow_trigger_id);

-- ---------------------------------------------------------------------
-- workflow_outputs — the sandbox that `db_write` steps write into.
-- Kept as its own table (rather than letting a step write to an
-- arbitrary user table) so a db_write step can never be used to
-- reach outside the workflow's own data.
-- ---------------------------------------------------------------------
create table public.workflow_outputs (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_workflow_outputs_run on public.workflow_outputs(workflow_run_id);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger trg_workflows_updated_at before update on public.workflows
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Aggregation #1: org-level usage this month (view)
-- ---------------------------------------------------------------------
create view public.org_usage_this_month as
select
  o.id as org_id,
  o.quota_calls_allowed,
  o.quota_calls_used,
  (o.quota_calls_allowed - o.quota_calls_used) as quota_calls_remaining,
  count(wr.id) filter (
    where wr.created_at >= date_trunc('month', now())
  ) as runs_this_month
from public.organizations o
left join public.workflow_runs wr on wr.org_id = o.id
group by o.id, o.quota_calls_allowed, o.quota_calls_used;

-- ---------------------------------------------------------------------
-- Aggregation #2: average run duration per workflow (used as a
-- computed field on `workflows`)
-- ---------------------------------------------------------------------
create function public.workflow_avg_run_duration_seconds(w_row public.workflows)
returns numeric
language sql stable as $$
  select avg(extract(epoch from (finished_at - started_at)))::numeric
  from public.workflow_runs
  where workflow_id = w_row.id
    and finished_at is not null;
$$;

-- ---------------------------------------------------------------------
-- Helper: most recent run per workflow, exposed as a relationship
-- target via a view (Hasura object relationship using computed FK).
-- ---------------------------------------------------------------------
create view public.workflow_latest_run as
select distinct on (workflow_id)
  workflow_id, id as run_id, status, started_at, finished_at
from public.workflow_runs
order by workflow_id, started_at desc;
