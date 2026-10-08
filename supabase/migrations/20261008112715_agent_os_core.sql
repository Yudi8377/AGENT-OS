-- Agent OS core schema
-- Apply to a dedicated Agent OS Supabase project only after reviewing the target.
-- No source repository catalog data is copied by this migration.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','builder','operator','reviewer','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  purpose text not null check (length(trim(purpose)) between 1 and 4000),
  instructions text not null default '' check (length(instructions) <= 20000),
  model_provider text,
  model_name text,
  status text not null default 'draft' check (status in ('draft','review','approved','disabled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agents_workspace_updated_idx on public.agents(workspace_id, updated_at desc);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id, workspace_id);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 120),
  entity_type text not null check (length(entity_type) between 1 and 80),
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_workspace_created_idx on public.audit_events(workspace_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.agents enable row level security;
alter table public.audit_events enable row level security;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace and wm.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_workspace_role(target_workspace uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = (select auth.uid())
      and wm.role = any(allowed_roles)
  );
$$;

create or replace function private.is_workspace_creator(target_workspace uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = target_workspace and w.created_by = (select auth.uid())
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.has_workspace_role(uuid, text[]) from public, anon;
revoke all on function private.is_workspace_creator(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, text[]) to authenticated;
grant execute on function private.is_workspace_creator(uuid) to authenticated;

create policy "profiles_select_self" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "workspaces_select_members_or_creator" on public.workspaces
  for select to authenticated using (created_by = (select auth.uid()) or private.is_workspace_member(id));
create policy "workspaces_insert_creator" on public.workspaces
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "workspaces_update_admins" on public.workspaces
  for update to authenticated using (private.has_workspace_role(id, array['owner','admin']))
  with check (private.has_workspace_role(id, array['owner','admin']));

create policy "members_select_same_workspace" on public.workspace_members
  for select to authenticated using (private.is_workspace_member(workspace_id));
-- Bootstrap only. Invitations and role changes need a separate audited server-side flow.
create policy "members_bootstrap_owner" on public.workspace_members
  for insert to authenticated with check (
    user_id = (select auth.uid()) and role = 'owner'
    and private.is_workspace_creator(workspace_id)
  );

create policy "agents_select_members" on public.agents
  for select to authenticated using (private.is_workspace_member(workspace_id));
create policy "agents_insert_builders" on public.agents
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and private.has_workspace_role(workspace_id, array['owner','admin','builder'])
  );
create policy "agents_update_builders" on public.agents
  for update to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin','builder']))
  with check (private.has_workspace_role(workspace_id, array['owner','admin','builder']));
create policy "agents_delete_admins" on public.agents
  for delete to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin']));

create policy "audit_select_privileged" on public.audit_events
  for select to authenticated using (private.has_workspace_role(workspace_id, array['owner','admin','reviewer']));
create policy "audit_insert_member" on public.audit_events
  for insert to authenticated with check (actor_id = (select auth.uid()) and private.is_workspace_member(workspace_id));

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert on public.workspace_members to authenticated;
grant select, insert, update, delete on public.agents to authenticated;
grant select, insert on public.audit_events to authenticated;

-- No anon access is granted. Never expose service-role keys in browser code.
