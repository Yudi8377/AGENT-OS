# Agent OS — Architecture & delivery plan

## Current foundation

- React + Vite modular UI with an explicit local-workspace status.
- Optional Supabase browser client using only the project URL and publishable key.
- Proposed core schema for profiles, workspaces, workspace membership, agent definitions, and audit events.
- Row Level Security is enabled for every exposed application table.
- Agent execution remains disabled until the server-side runtime is implemented and reviewed.

## Modules

1. **AI Directory** — source-linked entries with provenance and license review.
2. **Skills Studio** — metadata validation, security review, permission manifest, approval before install.
3. **Agent Builder** — persistent agent definitions and versioning.
4. **Orchestrator** — workflow definitions, typed nodes, validation, approval gates, retry and cancellation.
5. **Secure Runtime** — server-side provider adapters, secret storage, isolated execution, time/resource/network limits.
6. **Evaluation & Audit** — test suites, run outcomes, cost/latency metrics, immutable append-only events.
7. **Workspace & Governance** — authentication, membership, RBAC, policy, export and retention.

## Data boundaries

- The browser may only contain the Supabase URL and publishable key.
- Provider API keys, service-role keys, and other secrets belong only in server-side secret storage.
- Never execute imported skills or agent code automatically.
- Use workspace-scoped policies and validate permissions again on the server for external side effects.
- Audit events must avoid storing raw secrets, tokens, or unnecessary personal data.

## Bootstrap workflow

1. Create/select a dedicated Supabase project for Agent OS.
2. Review and apply the SQL migration in supabase/migrations to that project.
3. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in local/deployment environments.
4. Enable email confirmation and configure allowed redirect URLs in Supabase Auth.
5. Implement sign-in, workspace creation, agent CRUD, and audit logging; then run RLS/advisor tests.
6. Add server-side runtime and tool execution only after security review.

The SQL migration is committed as a proposal; it has **not** been applied to any connected Supabase project. This prevents accidental changes to the existing Education OS or AKVISIO databases.
