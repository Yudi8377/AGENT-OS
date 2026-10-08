# Agent OS — Architecture & delivery plan

## Current foundation

- React + Vite modular UI with an explicit local-workspace status.
- Optional Supabase browser client using only the project URL and publishable key.
- Applied schema for profiles, workspaces, workspace membership, agent definitions, audit events, and agent run history.
- Row Level Security is enabled for every exposed application table.
- Atomic `create_workspace` and role-checked `set_agent_status` RPCs record changes in the audit table.
- Deployed JWT-protected `agent-run` Edge Function: verifies user, workspace membership, role, and agent approval; calls OpenAI server-side only when configured; otherwise fails closed and records a blocked run.
- Current runtime has no external tools or code execution sandbox. It is a model-only execution slice, not production-complete.

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

1. Supabase project `tgicltoykzpsridyhvci` is the dedicated Agent OS project.
2. Applied migrations are tracked in `supabase/migrations`; keep filenames aligned with the recorded migration versions.
3. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in local/deployment environments.
4. Enable email confirmation and configure allowed redirect URLs in Supabase Auth.
5. Add `OPENAI_API_KEY` to Supabase Edge Function Secrets to enable model calls; never expose it to the browser.
6. Before production, implement quota/rate limits, model cost budgets, automated RLS tests, a sandbox for tools, workflow runner, and incident/retention policies.

Security Advisor warns about the two authenticated SECURITY DEFINER RPCs. These are intentionally executable only by the authenticated role and validate caller identity/role internally; continue reviewing their bodies whenever permissions change. Performance Advisor also reports three unindexed foreign keys.
