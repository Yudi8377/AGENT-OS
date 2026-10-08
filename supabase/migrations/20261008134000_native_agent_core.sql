-- AGENT-OS native capability registry and orchestration foundation.
-- Native-first: no arbitrary remote tool URLs, imported executable code, or provider-specific agent runtimes.
-- Skills are declarative, versionable instructions; executable actions must map to reviewed core handlers.

create table if not exists public.agent_skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  version integer not null default 1 check (version > 0),
  instructions text not null default '' check (length(instructions) <= 20000),
  input_schema jsonb not null default '{"type":"object","properties":{}}'::jsonb,
  output_schema jsonb not null default '{"type":"object","properties":{}}'::jsonb,
  permissions text[] not null default '{}',
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  status text not null default 'draft' check (status in ('draft','review','approved','disabled')),
  origin text not null default 'native' check (origin in ('native','imported_reference')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug, version)
);
create index if not exists agent_skills_workspace_status_idx on public.agent_skills(workspace_id, status, name);
alter table public.agent_skills enable row level security;
create policy "agent_skills_select_members" on public.agent_skills for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "agent_skills_insert_builders" on public.agent_skills for insert to authenticated
  with check (created_by = (select auth.uid()) and private.has_workspace_role(workspace_id, array['owner','admin','builder']));
create policy "agent_skills_update_builders" on public.agent_skills for update to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','builder']))
  with check (private.has_workspace_role(workspace_id, array['owner','admin','builder']));
create policy "agent_skills_delete_admins" on public.agent_skills for delete to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin']));
grant select, insert, update, delete on public.agent_skills to authenticated;

create table if not exists public.agent_tool_registry (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tool_key text not null check (tool_key ~ '^core\.[a-z0-9_.-]{2,100}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  input_schema jsonb not null default '{"type":"object","properties":{}}'::jsonb,
  output_schema jsonb not null default '{"type":"object","properties":{}}'::jsonb,
  required_permissions text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','review','approved','disabled')),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, tool_key)
);
create index if not exists agent_tool_registry_workspace_status_idx on public.agent_tool_registry(workspace_id, status);
alter table public.agent_tool_registry enable row level security;
create policy "agent_tool_registry_select_members" on public.agent_tool_registry for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "agent_tool_registry_insert_admins" on public.agent_tool_registry for insert to authenticated
  with check (created_by = (select auth.uid()) and private.has_workspace_role(workspace_id, array['owner','admin']));
create policy "agent_tool_registry_update_admins" on public.agent_tool_registry for update to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin']))
  with check (private.has_workspace_role(workspace_id, array['owner','admin']));
create policy "agent_tool_registry_delete_admins" on public.agent_tool_registry for delete to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin']));
grant select, insert, update, delete on public.agent_tool_registry to authenticated;

create table if not exists public.agent_workflows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  purpose text not null default '' check (length(purpose) <= 4000),
  definition jsonb not null default '{"version":1,"nodes":[],"edges":[]}'::jsonb,
  status text not null default 'draft' check (status in ('draft','review','approved','disabled')),
  max_steps integer not null default 20 check (max_steps between 1 and 100),
  max_duration_seconds integer not null default 120 check (max_duration_seconds between 1 and 900),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_workflows_workspace_updated_idx on public.agent_workflows(workspace_id, updated_at desc);
alter table public.agent_workflows enable row level security;
create policy "agent_workflows_select_members" on public.agent_workflows for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "agent_workflows_insert_builders" on public.agent_workflows for insert to authenticated
  with check (created_by = (select auth.uid()) and private.has_workspace_role(workspace_id, array['owner','admin','builder']));
create policy "agent_workflows_update_builders" on public.agent_workflows for update to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','builder']))
  with check (private.has_workspace_role(workspace_id, array['owner','admin','builder']));
create policy "agent_workflows_delete_admins" on public.agent_workflows for delete to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin']));
grant select, insert, update, delete on public.agent_workflows to authenticated;

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  memory_kind text not null check (memory_kind in ('working','episodic','semantic','procedural')),
  title text not null default '' check (length(title) <= 240),
  content text not null check (length(content) between 1 and 12000),
  metadata jsonb not null default '{}'::jsonb,
  source_run_id uuid references public.agent_runs(id) on delete set null,
  sensitivity text not null default 'internal' check (sensitivity in ('public','internal','restricted')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_memory_workspace_kind_idx on public.agent_memory(workspace_id, memory_kind, created_at desc);
create index if not exists agent_memory_agent_idx on public.agent_memory(agent_id, created_at desc);
alter table public.agent_memory enable row level security;
create policy "agent_memory_select_members" on public.agent_memory for select to authenticated
  using (private.is_workspace_member(workspace_id) and (sensitivity <> 'restricted' or private.has_workspace_role(workspace_id, array['owner','admin','reviewer'])));
create policy "agent_memory_insert_operators" on public.agent_memory for insert to authenticated
  with check (actor_id = (select auth.uid()) and private.has_workspace_role(workspace_id, array['owner','admin','builder','operator']));
create policy "agent_memory_update_privileged" on public.agent_memory for update to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','builder']))
  with check (private.has_workspace_role(workspace_id, array['owner','admin','builder']));
create policy "agent_memory_delete_privileged" on public.agent_memory for delete to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin']));
grant select, insert, update, delete on public.agent_memory to authenticated;

create table if not exists public.agent_evaluation_suites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  target_agent_id uuid references public.agents(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.agent_evaluation_cases (
  id uuid primary key default gen_random_uuid(),
  suite_id uuid not null references public.agent_evaluation_suites(id) on delete cascade,
  input_text text not null check (length(input_text) between 1 and 12000),
  expected_criteria jsonb not null default '{"must_include":[],"must_not_include":[]}'::jsonb,
  weight numeric(6,3) not null default 1 check (weight > 0 and weight <= 100),
  created_at timestamptz not null default now()
);
create index if not exists agent_eval_suites_workspace_idx on public.agent_evaluation_suites(workspace_id, updated_at desc);
create index if not exists agent_eval_cases_suite_idx on public.agent_evaluation_cases(suite_id);
alter table public.agent_evaluation_suites enable row level security;
alter table public.agent_evaluation_cases enable row level security;
create policy "agent_eval_suites_select_members" on public.agent_evaluation_suites for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "agent_eval_suites_manage_builders" on public.agent_evaluation_suites for all to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin','builder']))
  with check (created_by = (select auth.uid()) and private.has_workspace_role(workspace_id, array['owner','admin','builder']));
create policy "agent_eval_cases_select_members" on public.agent_evaluation_cases for select to authenticated
  using (exists (select 1 from public.agent_evaluation_suites s where s.id = suite_id and private.is_workspace_member(s.workspace_id)));
create policy "agent_eval_cases_manage_builders" on public.agent_evaluation_cases for all to authenticated
  using (exists (select 1 from public.agent_evaluation_suites s where s.id = suite_id and private.has_workspace_role(s.workspace_id, array['owner','admin','builder'])))
  with check (exists (select 1 from public.agent_evaluation_suites s where s.id = suite_id and private.has_workspace_role(s.workspace_id, array['owner','admin','builder'])));
grant select, insert, update, delete on public.agent_evaluation_suites to authenticated;
grant select, insert, update, delete on public.agent_evaluation_cases to authenticated;

-- These records are definitions only. Runtime must dispatch only through a server-side
-- allowlisted core handler registry; a DB row can never supply executable code or a URL.
