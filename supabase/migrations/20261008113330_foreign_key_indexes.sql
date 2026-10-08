-- Cover foreign-key columns used in ownership and audit relationships.
create index if not exists agents_created_by_idx on public.agents(created_by);
create index if not exists audit_events_actor_idx on public.audit_events(actor_id);
create index if not exists workspaces_created_by_idx on public.workspaces(created_by);
