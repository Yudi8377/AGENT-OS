import { authorizeNativeTool, executeNativeTool, planNativeGoal, resolveWorkflowInput, validateWorkflow, type NativeToolContext } from "./native-kernel.ts";

const context: NativeToolContext = {
  actorId: "actor-test",
  workspaceId: "workspace-test",
  agentApproved: true,
  workspaceRole: "admin",
  grantedPermissions: ["text:read", "json:validate", "math:calculate"],
  allowedTools: ["core.text.stats", "core.text.truncate", "core.text.lines", "core.json.validate", "core.math.calculate"],
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("text stats counts words and lines deterministically", () => {
  const result = executeNativeTool("core.text.stats", { text: "one two\nthree" }, context);
  assert(result.ok, "expected successful result");
  const data = result.data as Record<string, unknown>;
  assert(data.words === 3, "expected three words");
  assert(data.lines === 2, "expected two lines");
});

Deno.test("tool authorization rejects missing permissions", () => {
  const result = authorizeNativeTool("core.json.validate", {
    ...context, grantedPermissions: [], allowedTools: ["core.json.validate"],
  }, { text: "{}" });
  assert(!result.ok && result.code === "PERMISSION_DENIED", "expected permission denial");
});

Deno.test("tool authorization rejects tools outside compiled allowlist", () => {
  const result = authorizeNativeTool("core.system.shell", context, { command: "echo no" });
  assert(!result.ok && result.code === "TOOL_NOT_ALLOWLISTED", "expected allowlist rejection");
});

Deno.test("JSON validation parses valid JSON without executing it", () => {
  const result = executeNativeTool("core.json.validate", { text: '{"safe":true}' }, context);
  assert(result.ok, "expected successful validation");
  assert((result.data as Record<string, unknown>).valid === true, "expected valid JSON");
});

Deno.test("workflow validator rejects dependency cycles", () => {
  const result = validateWorkflow({ version: 1, nodes: [
    { id: "a", tool: "core.text.stats", dependsOn: ["b"], input: { text: "a" } },
    { id: "b", tool: "core.text.lines", dependsOn: ["a"], input: { text: "b" } },
  ] });
  assert(!result.ok && result.errors.includes("WORKFLOW_CYCLE_DETECTED"), "expected cycle detection");
});

Deno.test("workflow validator returns dependency-safe order", () => {
  const result = validateWorkflow({ version: 1, nodes: [
    { id: "second", tool: "core.text.lines", dependsOn: ["first"], input: { text: "b" } },
    { id: "first", tool: "core.text.stats", input: { text: "a" } },
  ] });
  assert(result.ok, "expected valid DAG");
  assert(result.orderedNodes[0].id === "first", "dependencies must execute before consumers");
});

Deno.test("workflow references map prior node output into later node input", () => {
  const resolved = resolveWorkflowInput({
    text: { $ref: "first.data.summary" },
    options: { count: { $ref: "first.data.words" } },
  }, {
    first: { ok: true, data: { summary: "hello world", words: 2 } },
  });
  assert(resolved.ok, "expected references to resolve");
  assert(resolved.value.text === "hello world", "expected string output mapping");
  assert((resolved.value.options as Record<string, unknown>).count === 2, "expected nested number output mapping");
});

Deno.test("workflow references reject unavailable or unsafe paths", () => {
  const unavailable = resolveWorkflowInput({ text: { $ref: "later.data.text" } }, {});
  assert(!unavailable.ok && unavailable.error === "WORKFLOW_REFERENCE_SOURCE_UNAVAILABLE", "expected unavailable source rejection");
  const unsafe = resolveWorkflowInput({ text: { $ref: "first.constructor.prototype" } }, {
    first: { ok: true, data: {} },
  });
  assert(!unsafe.ok && unsafe.error === "WORKFLOW_REFERENCE_INVALID", "expected unsafe path rejection");
});

Deno.test("native math parser respects arithmetic precedence and parentheses", () => {
  const result = executeNativeTool("core.math.calculate", { expression: "(2 + 3) * 4 - 6 / 2" }, context);
  assert(result.ok, "expected calculation to succeed");
  assert((result.data as Record<string, unknown>).result === 17, "expected result 17");
});

Deno.test("native math parser rejects code and division by zero", () => {
  const code = executeNativeTool("core.math.calculate", { expression: "globalThis.process()" }, context);
  assert(!code.ok, "expected code-like input to be rejected");
  const zero = executeNativeTool("core.math.calculate", { expression: "12 / 0" }, context);
  assert(!zero.ok && zero.error?.code === "MATH_DIVISION_BY_ZERO", "expected division by zero rejection");
});

Deno.test("native planner creates a bounded arithmetic plan", () => {
  const planned = planNativeGoal("math: (2 + 3) * 4");
  assert(planned.ok, "expected a supported goal to produce a plan");
  assert(planned.plan.planner === "native-deterministic-v1", "expected native planner identity");
  assert(planned.plan.steps.length === 1 && planned.plan.steps[0].tool === "core.math.calculate", "expected math tool selection");
});

Deno.test("native planner rejects unknown intents instead of guessing", () => {
  const planned = planNativeGoal("book a flight to Mars");
  assert(!planned.ok && planned.error === "GOAL_FORMAT_UNSUPPORTED", "expected unsupported goal rejection");
});


Deno.test("native planner creates a bounded two-step text report", () => {
  const planned = planNativeGoal("text-report: alpha\\nbeta");
  assert(planned.ok, "expected text report plan");
  assert(planned.plan.steps.length === 2, "expected two steps");
  assert(planned.plan.steps[0].tool === "core.text.stats", "stats must run first");
  assert(planned.plan.steps[1].dependsOn.includes("text_stats"), "line report must depend on stats");
});
