# AGENT-OS Native Agent Engine — Blueprint v1

## Product decision

AGENT-OS is the product and control plane. It must not be a thin wrapper, affiliate directory, or deep-link launcher for third-party agent products. We study public repositories and products for patterns, then implement original native capabilities with explicit provenance and licensing. Imported listings are references only; they are not runtime dependencies.

“Native” means the orchestration, policy, skill format, tool registry, memory, execution state, evaluation, audit, and user experience are owned by this project. It does not require training a foundation model from scratch on day one. Inference can later run on an open-weight model hosted on infrastructure controlled by the project. Any model backend must be behind a replaceable adapter; no third-party agent platform is the source of truth or orchestrator.

## Native engine layers

1. **Agent kernel** — run state machine, context assembly, plan/act/observe loop, cancellation, deadlines, step budget, and typed result envelopes.
2. **Planner** — converts a user goal into a bounded typed plan. Every step has an explicit input/output schema and dependency. The planner proposes; the policy engine authorizes.
3. **Policy engine** — validates identity, workspace scope, agent approval, skill/tool status, declared permissions, risk level, data sensitivity, budget, and human approval requirements before each action.
4. **Native tool registry** — only server-side handlers compiled and registered in the AGENT-OS codebase can execute. Database records describe tools but cannot introduce executable code, arbitrary URLs, shell commands, or remote callbacks.
5. **Native Skills Studio** — versioned declarative skill packages: metadata, instructions, input/output schema, permissions, risk, test cases, reviewer, and lifecycle. Imported skill repositories remain untrusted references until reviewed; do not auto-run downloaded code.
6. **Orchestrator** — typed DAG/workflow definitions, dependency resolution, retries with caps, timeout, cancellation, pause/resume, approval gates, and durable run state.
7. **Memory** — working, episodic, semantic, and procedural memory, each workspace-scoped, provenance-aware, expiring where appropriate, and filtered by sensitivity. Retrieval must not cross workspace boundaries.
8. **Evaluation lab** — test suites, expected criteria, regression comparisons, scoring, safety checks, and audit-linked results.
9. **Runtime isolation** — resource limits, restricted filesystem, no network by default, explicit egress allowlist, disposable execution environments, secret isolation, and per-step logging. Do not advertise code execution until this layer is deployed and tested.
10. **Observability and governance** — append-only audit trail, cost/latency/token metrics, quota controls, policy decisions, incident review, data retention, and human approval.

## Current foundation (2026-10-08)

- React/Vite UI, Supabase Auth, workspace membership/RBAC, agent approval lifecycle, audit events, and run history.
- 'agent-run' is a guarded text-only function; it is not a sandbox and does not execute arbitrary tools or code.
- A native capability schema migration has been applied and committed:
  - 'agent_skills': versioned declarative skill definitions.
  - 'agent_tool_registry': native 'core.*' tool definitions with schemas and permissions.
  - 'agent_workflows': bounded workflow definitions.
  - 'agent_memory': workspace-scoped memory types and sensitivity.
  - 'agent_evaluation_suites' and 'agent_evaluation_cases': test definitions.
- RLS and workspace role policies protect the new tables. These tables are a foundation, not a completed runtime; tool execution must still use an allowlisted server-side dispatcher.

## Implementation sequence

### Phase 1 — Native data and policy (started)
- [x] Persist workspace-scoped skills, tools, per-agent tool grants, workflows, memory, and evaluation cases.
- [x] Deploy a compiled allowlist dispatcher for deterministic native tools in the secured Edge Function.
- [x] Apply RLS and role-scoped policies to those records.
- [ ] Add database tests for cross-workspace isolation and role boundaries.
- [ ] Add server-side policy decision function and append-only policy audit events.

### Phase 2 — Deterministic kernel
- [ ] Define typed Plan, Step, ToolCall, Observation, and RunResult contracts.
- [ ] Build run state transitions: queued → planning → awaiting_approval/running → succeeded/failed/cancelled/timed_out.
- [ ] Implement bounded step loop, idempotency keys, cancellation, deadline, and structured errors.
- [x] Add native handlers: text statistics/truncation/line splitting and JSON validation.
- [ ] Add retrieval from workspace knowledge and safe calculations.
- [ ] Do not add shell, unrestricted filesystem, arbitrary HTTP, or dynamic code evaluation.

### Phase 3 — Model independence
- [ ] Introduce an inference adapter interface; provider-specific code stays behind the interface.
- [ ] Add a self-hosted open-weight model endpoint on project-controlled infrastructure as a deployable option.
- [ ] Keep a deterministic non-LLM fallback for schema validation, routing, and safe utility tools.
- [ ] Treat the model as a planner/reasoner, not an authorization authority. Policy is deterministic code.

### Phase 4 — Workflow and memory
- [x] Compile workflow DAGs, validate native node types/dependencies/cycles, enforce max steps/time, and persist the bounded run result. Per-node audit detail is recorded; full transition/event history remains future work.
- [ ] Add memory write/retrieval APIs with provenance, expiry, sensitivity filtering, and workspace scope.
- [x] Block workflow nodes that declare a human approval gate until a separate approval-resume mechanism exists. Durable approval/resume is still pending.

### Phase 5 — Secure execution and operations
- [ ] Add an isolated worker/sandbox under project control; Edge Functions alone are not a general-purpose code sandbox.
- [ ] Enforce CPU/memory/time/output budgets and default-deny network egress.
- [ ] Add secrets vault integration, redaction, quotas, abuse controls, alerts, and disaster recovery.
- [ ] Run security, RLS, adversarial prompt, workflow, and regression suites before enabling risky capabilities.

## Non-negotiable invariants

- No third-party agent product is required to create, plan, orchestrate, store memory, enforce policy, or evaluate workflows.
- No model/provider response can grant itself permissions.
- No database row can cause arbitrary code or an arbitrary URL to execute.
- No tool runs without server-side identity, workspace, policy, permission, and approval checks.
- No cross-workspace memory retrieval.
- No claim of “sandboxed” or “fully autonomous” before those controls are deployed and tested.
- Every action must have a traceable run ID, step ID, actor, policy decision, timestamps, and structured outcome.
