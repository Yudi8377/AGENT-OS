# Agent OS — Architecture & delivery plan

## Product direction: native-first

AGENT-OS is an agent platform we own, not a wrapper around third-party agent services. The public repositories that informed the project are research/catalog inputs only. Core capabilities—planning contracts, policy, skill lifecycle, tool dispatch, orchestration, memory, evaluation, and audit—must be implemented in this repository and its controlled backend. Do not make third-party agent products or links a runtime requirement.

Native-first does not mean pretending a model can be trained from scratch immediately. Keep inference behind a replaceable interface and build a path to serving open-weight models on infrastructure controlled by the project. The model proposes plans; deterministic server-side policy authorizes actions.

## Current foundation

- React + Vite UI with an explicit runtime status.
- Supabase Auth, workspace membership/RBAC, agent approval lifecycle, audit events, and run history.
- Deployed JWT-protected 'agent-run' Edge Function currently provides guarded text-only execution; it is not a sandbox and does not execute arbitrary tools or code.
- Applied native schema for 'agent_skills', 'agent_tool_registry', 'agent_workflows', 'agent_memory', 'agent_evaluation_suites', and 'agent_evaluation_cases'. All are workspace-scoped and have RLS/role policies.
- The native tool registry accepts only 'core.*' identifiers. Registry rows are declarative; they cannot supply executable code, arbitrary URLs, shell commands, or remote callbacks.
- Edge Function 'agent-run' version 3 includes a compiled native dispatcher for four deterministic tools (text statistics, text truncation, numbered lines, JSON validation). Dispatch requires an approved registry entry and an active per-agent grant with matching permissions. Admin grant UI is not implemented yet.
- Detailed design and phased delivery are documented in 'docs/native-agent-engine.md'.

## Native modules

1. **Agent kernel** — typed run lifecycle, plan/act/observe, deadline, cancellation, step budget, structured result.
2. **Policy engine** — identity, workspace, approval, permission, risk, data sensitivity, and budget checks before each action.
3. **Skills Studio** — native declarative skills with schema, permissions, versioning, review, and tests.
4. **Native tool registry** — reviewed server-side handlers; deny-by-default dispatch.
5. **Orchestrator** — typed DAG workflows, dependency resolution, bounded retries, pause/resume, and approval gates.
6. **Memory** — workspace-scoped working, episodic, semantic, and procedural memory with provenance and expiry.
7. **Evaluation & Audit** — regression suites, policy outcomes, run/step trace, latency, resource and cost tracking.
8. **Secure Runtime** — isolated worker/sandbox, resource limits, default-deny egress, and secret isolation.
9. **AI Directory** — research catalog only; never required for core product execution.
10. **Workspace & Governance** — Auth, RLS, RBAC, approval, audit, retention, and incident review.

## Data and security boundaries

- Browser contains only Supabase URL and publishable key.
- Provider/model secrets stay server-side.
- A model response is never authorization.
- No registry row may execute code or an arbitrary URL.
- Imported skills are untrusted and never auto-executed.
- Every action must validate user, workspace, approval, permissions, policy, limits, and risk on the server.
- Memory retrieval must preserve workspace scope and sensitivity.
- Edge Functions are not treated as general-purpose sandbox workers.

## Delivery phases

### Phase 1 — native data foundation (completed for schema)
- [x] Skills, tool registry, workflows, memory, evaluation suite/cases tables.
- [x] RLS and role-scoped access policies.
- [ ] Automated cross-workspace/RBAC tests and policy decision audit.

### Phase 2 — deterministic kernel
- [ ] Typed Plan/Step/ToolCall/Observation/RunResult contracts.
- [ ] Durable run state machine and bounded execution loop.
- [ ] Native safe handlers: text/JSON transforms, workspace retrieval, calculations.
- [ ] Idempotency, cancellation, deadline, structured error handling.

### Phase 3 — native orchestration and memory
- [ ] DAG validator/compiler, step persistence, bounded retries, approval gates.
- [ ] Memory APIs with provenance, expiry, and sensitivity filters.
- [ ] Evaluation runner and regression report.

### Phase 4 — model independence
- [ ] Inference interface with deterministic fallback for schema/routing.
- [ ] Self-hosted open-weight model option on controlled infrastructure.
- [ ] Model never bypasses policy or grants permissions.

### Phase 5 — secure execution
- [ ] Project-controlled isolated worker, not an external agent platform.
- [ ] CPU/memory/time/output limits, filesystem controls, default-deny egress.
- [ ] Secrets isolation, quotas, alerts, incident response, and disaster recovery.
- [ ] Security, RLS, adversarial, workflow, and regression tests before risky actions are enabled.

## Deployment configuration

- Supabase project: 'tgicltoykzpsridyhvci'.
- GitHub Pages: 'https://yudi8377.github.io/AGENT-OS/'.
- Keep secrets out of Git and browser bundles.
- Do not describe code execution, a full sandbox, or autonomous tool use as active until implemented and tested.
