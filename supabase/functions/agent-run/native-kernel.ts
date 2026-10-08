/**
 * AGENT-OS native kernel primitives.
 *
 * This module is intentionally deterministic and dependency-free. It does not
 * execute code from database records, download skills, or call remote agent APIs.
 * Import into a server-side Edge Function; never expose tool execution to the browser.
 */

export type JsonValue =
  | string | number | boolean | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type CoreToolKey =
  | "core.text.stats"
  | "core.text.truncate"
  | "core.text.lines"
  | "core.json.validate"
  | "core.math.calculate";

export type RiskLevel = "low" | "medium" | "high";

export interface NativeToolDefinition {
  key: CoreToolKey;
  description: string;
  requiredPermissions: string[];
  risk: RiskLevel;
  maxInputBytes: number;
  maxOutputBytes: number;
}

export interface NativeToolContext {
  actorId: string;
  workspaceId: string;
  agentApproved: boolean;
  workspaceRole: "owner" | "admin" | "builder" | "operator" | "reviewer" | "viewer";
  grantedPermissions: string[];
  allowedTools: CoreToolKey[];
}

export interface NativeToolResult {
  ok: boolean;
  tool: CoreToolKey;
  data?: JsonValue;
  error?: { code: string; message: string };
  durationMs: number;
}

export interface WorkflowNode {
  id: string;
  tool: string;
  dependsOn?: string[];
  input?: Record<string, JsonValue>;
  requiresApproval?: boolean;
}

export interface WorkflowDefinition {
  version: 1;
  nodes: WorkflowNode[];
}

export const NATIVE_TOOL_REGISTRY: Record<CoreToolKey, NativeToolDefinition> = {
  "core.text.stats": {
    key: "core.text.stats",
    description: "Return deterministic character, word, line, and paragraph counts.",
    requiredPermissions: ["text:read"],
    risk: "low",
    maxInputBytes: 12000,
    maxOutputBytes: 2048,
  },
  "core.text.truncate": {
    key: "core.text.truncate",
    description: "Trim text to a requested maximum character count.",
    requiredPermissions: ["text:read"],
    risk: "low",
    maxInputBytes: 12000,
    maxOutputBytes: 12000,
  },
  "core.text.lines": {
    key: "core.text.lines",
    description: "Split text into numbered lines without executing its contents.",
    requiredPermissions: ["text:read"],
    risk: "low",
    maxInputBytes: 12000,
    maxOutputBytes: 24000,
  },
  "core.json.validate": {
    key: "core.json.validate",
    description: "Parse JSON and return validity plus the parsed value.",
    requiredPermissions: ["json:validate"],
    risk: "low",
    maxInputBytes: 12000,
    maxOutputBytes: 24000,
  },
  "core.math.calculate": {
    key: "core.math.calculate",
    description: "Evaluate bounded arithmetic expressions using a native parser, without eval or dynamic code.",
    requiredPermissions: ["math:calculate"],
    risk: "low",
    maxInputBytes: 512,
    maxOutputBytes: 256,
  },
};

const encoder = new TextEncoder();
const byteLength = (value: unknown) => encoder.encode(JSON.stringify(value) ?? "").byteLength;

function fail(tool: CoreToolKey, code: string, message: string, start: number): NativeToolResult {
  return { ok: false, tool, error: { code, message }, durationMs: Date.now() - start };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


/** Small arithmetic parser: no eval, variables, function calls, or property access. */
function calculateArithmetic(expression: string): number {
  if (!expression.trim() || expression.length > 256) throw new Error("MATH_EXPRESSION_INVALID");
  const tokens = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%]/g) ?? [];
  const compact = expression.replace(/\s+/g, "");
  if (tokens.join("") !== compact || tokens.length > 128) throw new Error("MATH_EXPRESSION_INVALID");
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const finite = (value: number) => {
    if (!Number.isFinite(value) || Math.abs(value) > 1e15) throw new Error("MATH_RESULT_OUT_OF_RANGE");
    return value;
  };
  function primary(): number {
    const token = take();
    if (token === "(") {
      const value = sum();
      if (take() !== ")") throw new Error("MATH_EXPRESSION_INVALID");
      return value;
    }
    if (token === "+" || token === "-") {
      const value = primary();
      return token === "-" ? -value : value;
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error("MATH_EXPRESSION_INVALID");
    return Number(token);
  }
  function product(): number {
    let value = primary();
    while (["*", "/", "%"].includes(peek() ?? "")) {
      const op = take();
      const rhs = primary();
      if ((op === "/" || op === "%") && rhs === 0) throw new Error("MATH_DIVISION_BY_ZERO");
      value = finite(op === "*" ? value * rhs : op === "/" ? value / rhs : value % rhs);
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const op = take();
      const rhs = product();
      value = finite(op === "+" ? value + rhs : value - rhs);
    }
    return value;
  }
  const result = sum();
  if (position !== tokens.length) throw new Error("MATH_EXPRESSION_INVALID");
  return finite(result);
}

/** Server-side authorization gate. A model or user input cannot override this result. */
export function authorizeNativeTool(
  toolKey: string,
  context: NativeToolContext,
  input: unknown,
): { ok: true; tool: NativeToolDefinition } | { ok: false; code: string; message: string } {
  if (!context.actorId || !context.workspaceId) {
    return { ok: false, code: "IDENTITY_REQUIRED", message: "Authenticated actor and workspace are required." };
  }
  if (!context.agentApproved) {
    return { ok: false, code: "AGENT_NOT_APPROVED", message: "Agent must be approved before execution." };
  }
  if (!["owner", "admin", "builder", "operator"].includes(context.workspaceRole)) {
    return { ok: false, code: "ROLE_FORBIDDEN", message: "Workspace role cannot execute native tools." };
  }
  if (!Object.hasOwn(NATIVE_TOOL_REGISTRY, toolKey)) {
    return { ok: false, code: "TOOL_NOT_ALLOWLISTED", message: "Tool is not in the compiled native allowlist." };
  }
  const tool = NATIVE_TOOL_REGISTRY[toolKey as CoreToolKey];
  if (!context.allowedTools.includes(tool.key)) {
    return { ok: false, code: "TOOL_NOT_GRANTED", message: "Tool has not been granted to this agent." };
  }
  if (!tool.requiredPermissions.every((permission) => context.grantedPermissions.includes(permission))) {
    return { ok: false, code: "PERMISSION_DENIED", message: "Required tool permission is missing." };
  }
  if (byteLength(input) > tool.maxInputBytes) {
    return { ok: false, code: "INPUT_LIMIT_EXCEEDED", message: "Tool input exceeds its configured limit." };
  }
  return { ok: true, tool };
}

/** Executes only compiled, deterministic handlers. It never evaluates strings as code. */
export function executeNativeTool(
  toolKey: string,
  input: unknown,
  context: NativeToolContext,
): NativeToolResult {
  const start = Date.now();
  const auth = authorizeNativeTool(toolKey, context, input);
  if (!auth.ok) return fail(
    (Object.hasOwn(NATIVE_TOOL_REGISTRY, toolKey) ? toolKey : "core.text.stats") as CoreToolKey,
    auth.code,
    auth.message,
    start,
  );

  if (!isRecord(input)) return fail(auth.tool.key, "INVALID_INPUT", "Input must be a JSON object.", start);
  let data: JsonValue;

  switch (auth.tool.key) {
    case "core.text.stats": {
      if (typeof input.text !== "string") return fail(auth.tool.key, "INVALID_INPUT", "'text' must be a string.", start);
      const text = input.text;
      const trimmed = text.trim();
      data = {
        characters: text.length,
        words: trimmed ? trimmed.split(/\s+/u).length : 0,
        lines: text.length ? text.split(/\r?\n/u).length : 0,
        paragraphs: trimmed ? trimmed.split(/\n\s*\n/u).filter(Boolean).length : 0,
      };
      break;
    }
    case "core.text.truncate": {
      if (typeof input.text !== "string" || !Number.isInteger(input.maxChars)) {
        return fail(auth.tool.key, "INVALID_INPUT", "'text' and integer 'maxChars' are required.", start);
      }
      const maxChars = input.maxChars as number;
      if (maxChars < 0 || maxChars > 10000) return fail(auth.tool.key, "INVALID_INPUT", "'maxChars' must be between 0 and 10000.", start);
      data = { text: (input.text as string).slice(0, maxChars), truncated: (input.text as string).length > maxChars };
      break;
    }
    case "core.text.lines": {
      if (typeof input.text !== "string") return fail(auth.tool.key, "INVALID_INPUT", "'text' must be a string.", start);
      data = { lines: (input.text as string).split(/\r?\n/u).map((text, index) => ({ number: index + 1, text })) };
      break;
    }
    case "core.json.validate": {
      if (typeof input.text !== "string") return fail(auth.tool.key, "INVALID_INPUT", "'text' must contain JSON as a string.", start);
      try {
        data = { valid: true, value: JSON.parse(input.text) as JsonValue };
      } catch {
        data = { valid: false, value: null };
      }
      break;
    }
    case "core.math.calculate": {
      if (typeof input.expression !== "string") return fail(auth.tool.key, "INVALID_INPUT", "'expression' must be a string.", start);
      try {
        data = { expression: input.expression, result: calculateArithmetic(input.expression) };
      } catch (error) {
        return fail(auth.tool.key, error instanceof Error ? error.message : "MATH_EXPRESSION_INVALID", "Expression is invalid or outside the safe calculation range.", start);
      }
      break;
    }
  }

  if (byteLength(data!) > auth.tool.maxOutputBytes) {
    return fail(auth.tool.key, "OUTPUT_LIMIT_EXCEEDED", "Tool output exceeds its configured limit.", start);
  }
  return { ok: true, tool: auth.tool.key, data: data!, durationMs: Date.now() - start };
}

/** Validate workflow structure and return a safe topological execution order. */

/**
 * Resolve explicit workflow references such as { "$ref": "stepA.data.words" }.
 * Only completed, successful prior-node results can be referenced. No expression
 * evaluation, prototype traversal, or arbitrary code is permitted.
 */
export function resolveWorkflowInput(
  input: Record<string, JsonValue>,
  completedResults: Record<string, unknown>,
): { ok: true; value: Record<string, JsonValue> } | { ok: false; error: string } {
  const blockedKeys = new Set(["__proto__", "prototype", "constructor"]);
  function resolve(value: unknown, depth: number): unknown {
    if (depth > 12) throw new Error("WORKFLOW_REFERENCE_DEPTH_EXCEEDED");
    if (Array.isArray(value)) return value.map((item) => resolve(item, depth + 1));
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (Object.keys(record).length === 1 && typeof record.$ref === "string") {
        const path = record.$ref.split(".");
        if (path.length < 2 || path.some((part) => !part || blockedKeys.has(part))) {
          throw new Error("WORKFLOW_REFERENCE_INVALID");
        }
        const sourceNode = path[0];
        const source = completedResults[sourceNode] as Record<string, unknown> | undefined;
        if (!source || source.ok !== true) throw new Error("WORKFLOW_REFERENCE_SOURCE_UNAVAILABLE");
        let current: unknown = source;
        for (const part of path.slice(1)) {
          if (!current || typeof current !== "object" || Array.isArray(current) || !Object.hasOwn(current, part)) {
            throw new Error("WORKFLOW_REFERENCE_PATH_NOT_FOUND");
          }
          current = (current as Record<string, unknown>)[part];
        }
        if (current === undefined) throw new Error("WORKFLOW_REFERENCE_PATH_NOT_FOUND");
        return current;
      }
      const output: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(record)) {
        if (blockedKeys.has(key)) throw new Error("WORKFLOW_REFERENCE_INVALID_KEY");
        output[key] = resolve(child, depth + 1);
      }
      return output;
    }
    return value;
  }
  try {
    const value = resolve(input, 0);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "WORKFLOW_INPUT_INVALID" };
    }
    return { ok: true, value: value as Record<string, JsonValue> };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "WORKFLOW_REFERENCE_FAILED" };
  }
}

export function validateWorkflow(
  workflow: WorkflowDefinition,
  maxSteps = 20,
): { ok: true; orderedNodes: WorkflowNode[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!workflow || workflow.version !== 1 || !Array.isArray(workflow.nodes)) {
    return { ok: false, errors: ["WORKFLOW_SCHEMA_INVALID"] };
  }
  if (workflow.nodes.length === 0 || workflow.nodes.length > Math.min(maxSteps, 100)) {
    return { ok: false, errors: ["WORKFLOW_STEP_LIMIT_INVALID"] };
  }

  const byId = new Map<string, WorkflowNode>();
  for (const node of workflow.nodes) {
    if (!node.id || node.id.length > 80 || byId.has(node.id)) errors.push("NODE_ID_INVALID_OR_DUPLICATE");
    byId.set(node.id, node);
    if (typeof node.tool !== "string" || !Object.hasOwn(NATIVE_TOOL_REGISTRY, node.tool)) errors.push("NODE_TOOL_NOT_ALLOWLISTED");
    if (node.requiresApproval && typeof node.requiresApproval !== "boolean") errors.push("APPROVAL_FLAG_INVALID");
  }
  for (const node of workflow.nodes) {
    for (const dependency of node.dependsOn ?? []) {
      if (!byId.has(dependency)) errors.push("DEPENDENCY_NOT_FOUND");
      if (dependency === node.id) errors.push("SELF_DEPENDENCY");
    }
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  const indegree = new Map<string, number>();
  const next = new Map<string, string[]>();
  for (const node of workflow.nodes) {
    indegree.set(node.id, (node.dependsOn ?? []).length);
    for (const dependency of node.dependsOn ?? []) {
      const list = next.get(dependency) ?? [];
      list.push(node.id);
      next.set(dependency, list);
    }
  }
  const queue = workflow.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const ordered: WorkflowNode[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    ordered.push(byId.get(id)!);
    for (const child of next.get(id) ?? []) {
      const degree = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, degree);
      if (degree === 0) queue.push(child);
    }
  }
  if (ordered.length !== workflow.nodes.length) return { ok: false, errors: ["WORKFLOW_CYCLE_DETECTED"] };
  return { ok: true, orderedNodes: ordered };
}
