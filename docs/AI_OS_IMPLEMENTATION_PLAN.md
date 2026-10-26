# AI-OS Implementation Plan

Status: proposal for review. This document is a roadmap, not evidence that the listed capabilities are already implemented.

## Product direction

Use AGENT-OS as the native-first multi-agent orchestration and governance foundation. NADYA is the first product to consume these capabilities. Keep GitHub/GitHub Pages and Supabase as the current infrastructure baseline; do not introduce another hosting/backend platform without an explicit cost and architecture review.

The long-term direction is a measurable learning system and, later, research toward robotics/humanoid integration. ChatGPT/GPT-6 itself is not modified by this repository. Persistent improvement must be implemented through external memory, retrieval, evaluations, controlled code changes, and—only when justified—separately trained or fine-tuned models.

## Current baseline (from repository documentation)

AGENT-OS documents a published GitHub Pages frontend, Supabase workspace/RBAC foundations, agent approval lifecycle, audit records, memory/tool/workflow/evaluation schema foundations, and a limited deterministic tool dispatcher. Its README also records missing or incomplete general planning, complete workflow execution, sandboxing, integrated memory retrieval, end-to-end evaluations, resource isolation, and independent penetration testing.

NADYA documents an Indonesian-first companion, modular orchestration, permission-aware capabilities, user-controlled memory, and a Supabase Edge Function-based provider path. Its README says the generative backend is not production-ready until deployment and provider configuration are verified.

These statements are repository documentation and must be checked against live configuration and test evidence before being treated as operational facts.

## Design principles

1. **Evidence before claims:** distinguish planned, implemented, configured, tested, and production-verified capabilities.
2. **Native-first orchestration:** AGENT-OS owns agent lifecycle, policy decisions, tool grants, workflow state, memory provenance, evaluations, and audit records.
3. **Least privilege:** each agent receives only explicit, scoped capabilities; tool access is denied by default.
4. **Human approval for consequential changes:** no autonomous production deployment, secret changes, destructive database operations, physical-world actions, or paid resource creation without explicit policy and authorization.
5. **Low-cost and replaceable models:** route by task quality, latency, privacy, and cost. Do not require multiple model providers for the first milestone.
6. **Privacy by design:** minimize stored conversation content; make durable memory inspectable, exportable, and deletable; never store credentials in memory.
7. **Reproducible evaluation:** benchmark before and after each change; retain versioned test cases and regression results.
8. **Safe experiments:** run generated code and untrusted tools only in an isolated environment with time, network, CPU, memory, and output limits.
9. **No self-modifying production code:** agents may propose patches and open pull requests; CI and a review/approval gate determine whether changes are accepted.
10. **Robotics separation:** language models propose plans; dedicated perception, motion-planning, and real-time safety controllers enforce physical limits.

## Delivery phases

### Phase 0 — Baseline and safety gates

- Confirm the current default branch, CI status, deployment state, Supabase project binding, Edge Function deployment, and secret names without exposing secret values.
- Establish an explicit capability status vocabulary: `planned`, `implemented`, `configured`, `tested`, `verified`, `disabled`, and `blocked`.
- Add a release checklist and a single source of truth for environment configuration.
- Confirm no credentials or user data are present in frontend bundles or repository history.

**Acceptance:** baseline report links to commit, workflow, configuration evidence, and test results; no claim of live inference without a successful end-to-end test.

### Phase 1 — Native multi-agent contracts

Define typed input/output contracts for Research, Planning, Engineering, QA/Security, Memory, and Learning agents. The orchestrator owns delegation, budgets, timeouts, cancellation, conflict resolution, and final synthesis. Agents cannot grant themselves capabilities.

**Acceptance:** deterministic unit tests cover routing, invalid output, timeouts, denied permissions, budget exhaustion, and conflicting specialist results.

### Phase 2 — Memory and knowledge

Separate session context, user-approved durable memory, project state, and source-grounded knowledge. Attach provenance, timestamps, confidence, and expiry/review rules to retrieved knowledge. Support user inspection, export, correction, and deletion.

**Acceptance:** tests verify workspace isolation, permission enforcement, source attribution, stale-data handling, and memory deletion behavior.

### Phase 3 — Evaluation and controlled learning loop

Create a versioned evaluation suite with task success, factuality/source support, latency, cost, tool safety, and regression metrics. Schedule research and evaluation reports. The system may recommend code/model changes but must not silently promote them.

**Acceptance:** each proposed change has a baseline comparison, reproducible run record, rollback path, and explicit approval status.

### Phase 4 — Secure tools and durable workflows

Implement allowlisted tool adapters, per-agent grants, idempotency, bounded retries, durable state, pause/resume, approval checkpoints, cancellation, and sandbox isolation. Do not execute arbitrary generated code in the application process.

**Acceptance:** adversarial tests demonstrate that unapproved tools, cross-workspace access, prompt-injected instructions, and over-budget actions are blocked and audited.

### Phase 5 — NADYA integration

Integrate NADYA through a versioned internal API/contract rather than coupling its UI directly to AGENT-OS internals. Preserve Indonesian-first interaction, avatar/voice roadmap, user-controlled memory, and a separate administrator control center.

**Acceptance:** end-to-end tests cover chat, provider failure, unavailable provider, consent, memory controls, capability denial, and transparent error states.

### Phase 6 — Model and robotics research

Compare API models and open-weight/local models using the same evaluation suite. Fine-tuning is a separate research decision requiring lawful data, a measurable target, compute/cost analysis, and regression testing. Robotics work begins in simulation and uses dedicated safety controllers before any hardware experiments.

**Acceptance:** a written evaluation report demonstrates measurable benefit and documented risks before a model or physical capability is adopted.

## Daily technology intelligence

A daily report should prioritize primary sources and official release notes, include publication dates and links, distinguish research prototypes from stable releases, and explain licensing, cost, security, and relevance to AGENT-OS/NADYA. A report does not itself update model weights or deploy software.

## Immediate next steps

1. Verify repository CI and the live Supabase/Edge Function state; current tool access did not permit inspection of the Supabase project.
2. Inspect existing kernel, dispatcher, schema, and tests before changing runtime behavior.
3. Implement one bounded milestone at a time on a branch, run the repository's existing checks, and open a pull request for review.
4. Do not merge or deploy a change solely because an AI agent recommends it.

## Explicit non-goals for the initial release

- No claim that the base ChatGPT model learns autonomously or changes its own weights.
- No uncontrolled self-modifying code or autonomous production deployment.
- No arbitrary shell/code execution in the trusted runtime.
- No silent microphone/camera activation or physical robot control without explicit permission and safety constraints.
- No new paid platform or model dependency without a cost review.
