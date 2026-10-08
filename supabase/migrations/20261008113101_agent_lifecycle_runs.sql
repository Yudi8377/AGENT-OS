-- Agent OS agent lifecycle, run history, and execution permissions.
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'running'
    check (status in ('running','succeeded','failed','blocked')),
  input_text text not null check (length(input_text) between 1 and 12000),
  output_text text check (output_text is null or length(output_text) <= 50000),
  provider text,
  model text,
  error_code text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists agent_runs_workspace_created_idx
  on public.agent_runs(workspace_id, created_at desc);
create index if not exists agent_runs_agent_created_idx
  on public.agent_runs(agent_id, created_at desc);
create index if not exists agent_runs_actor_created_idx
  on public.agent_runs(actor_id, created_at desc);

alter table public.agent_runs enable row level security;
grant select on public.agent_runs to authenticated;

create policy "agent_runs_select_own_or_reviewers"
on public.agent_runs for select to authenticated
using (
  actor_id = (select auth.uid())
  or private.has_workspace_role(workspace_id, array['owner','admin','reviewer'])
);

create or replace function public.set_agent_status(p_agent_id uuid, p_status text)
returns table (id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_current_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_status not in ('draft','review','approved','disabled') then
    raise exception 'Invalid agent status' using errcode = '22023';
  end if;

  select a.workspace_id, a.status
    into v_workspace_id, v_current_status
  from public.agents a
  where a.id = p_agent_id;

  if v_workspace_id is null then
    raise exception 'Agent not found' using errcode = 'P0002';
  end if;

  if p_status = 'approved' then
    if not private.has_workspace_role(v_workspace_id, array['owner','admin']) then
      raise exception 'Only workspace owners or admins can approve agents' using errcode = '42501';
    end if;
    if v_current_status <> 'review' then
      raise exception 'Only agents in review can be approved' using errcode = '22023';
    end if;
  elsif p_status = 'review' then
    if not private.has_workspace_role(v_workspace_id, array['owner','admin','builder']) then
      raise exception 'Builder or workspace admin role required' using errcode = '42501';
    end if;
    if v_current_status not in ('draft','disabled') then
      raise exception 'Only draft or disabled agents can enter review' using errcode = '22023';
    end if;
  elsif p_status = 'disabled' then
    if not private.has_workspace_role(v_workspace_id, array['owner','admin']) then
      raise exception 'Only workspace owners or admins can disable agents' using errcode = '42501';
    end if;
  elsif p_status = 'draft' then
    if not private.has_workspace_role(v_workspace_id, array['owner','admin','builder']) then
      raise exception 'Builder or workspace admin role required' using errcode = '42501';
    end if;
  end if;

  update public.agents a
    set status = p_status, updated_at = now()
    where a.id = p_agent_id;

  insert into public.audit_events (workspace_id, actor_id, action, entity_type, entity_id, details)
  values (v_workspace_id, v_user_id, 'agent.status_changed', 'agent', p_agent_id::text,
          jsonb_build_object('from', v_current_status, 'to', p_status));

  return query select a.id, a.status from public.agents a where a.id = p_agent_id;
end;
$$;

revoke all on function public.set_agent_status(uuid, text) from public, anon;
grant execute on function public.set_agent_status(uuid, text) to authenticated;
