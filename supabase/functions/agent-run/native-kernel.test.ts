import { authorizeNativeTool, executeNativeTool, validateWorkflow, type NativeToolContext } from "./native-kernel.ts";

const context: NativeToolContext = {
  actorId: "actor-test",
  workspaceId: "workspace-test",
  agentApproved: true,
  workspaceRole: "admin",
  grantedPermissions: ["text:read", "json:validate"],
  allowedTools: ["core.text.stats", "core.text.truncate", "core.text.lines", "core.json.validate"],
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
