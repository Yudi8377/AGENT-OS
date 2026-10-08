-- Agent OS workspace bootstrap hardening
-- Atomically create workspace + owner membership, and maintain profile/timestamps.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function private.set_updated_at();

drop trigger if exists agents_set_updated_at on public.agents;
create trigger agents_set_updated_at
before update on public.agents
for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''))
  on conflict (id) do update
    set display_name = coalesce(excluded.display_name, public.profiles.display_name);
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_agent_os on auth.users;
create trigger on_auth_user_created_agent_os
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function public.create_workspace(p_name text, p_slug text)
returns table (id uuid, name text, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(v_name) < 1 or length(v_name) > 120 then
    raise exception 'Workspace name must be between 1 and 120 characters' using errcode = '22023';
  end if;

  if length(v_slug) < 3 or length(v_slug) > 60
     or v_slug !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' then
    raise exception 'Workspace slug must be 3-60 lowercase letters, digits, or hyphens and start/end with a letter or digit' using errcode = '22023';
  end if;

  insert into public.workspaces (name, slug, created_by)
  values (v_name, v_slug, v_user_id)
  returning workspaces.id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner');

  insert into public.audit_events (workspace_id, actor_id, action, entity_type, entity_id, details)
  values (v_workspace_id, v_user_id, 'workspace.created', 'workspace', v_workspace_id::text,
          jsonb_build_object('name', v_name, 'slug', v_slug));

  return query
    select w.id, w.name, w.slug
    from public.workspaces as w
    where w.id = v_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;
