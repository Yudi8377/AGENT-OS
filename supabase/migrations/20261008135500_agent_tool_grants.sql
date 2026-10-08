-- Explicit per-agent grants for the compiled native tool registry.
create table if not exists public.agent_tool_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  tool_key text not null check (tool_key ~ '^core\.[a-z0-9_.-]{2,100}$'),
  granted_permissions text[] not null default '{}',
  status text not null default 'active' check (status in ('active','revoked')),
  granted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, tool_key),
  unique (id, workspace_id)
);
create index if not exists agent_tool_grants_workspace_agent_idx on public.agent_tool_grants(workspace_id, agent_id, status);
alter table public.agent_tool_grants enable row level security;
create policy "agent_tool_grants_select_members" on public.agent_tool_grants for select to authenticated
  using (private.is_workspace_member(workspace_id));
create policy "agent_tool_grants_manage_admins" on public.agent_tool_grants for all to authenticated
  using (private.has_workspace_role(workspace_id, array['owner','admin']))
  with check (
    granted_by = (select auth.uid())
    and private.has_workspace_role(workspace_id, array['owner','admin'])
    and exists (
      select 1 from public.agents a
      where a.id = agent_id and a.workspace_id = workspace_id
    )
  );
grant select, insert, update, delete on public.agent_tool_grants to authenticated;
