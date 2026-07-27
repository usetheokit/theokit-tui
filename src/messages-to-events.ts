/**
 * `@theokit/tui` — project a client message snapshot onto the two shapes this package renders
 * (`AgentEvent[]` for `<AgentTimeline>`, `ChatThreadMessage[]` for `<ChatThread>`), with NO dependency on
 * the `ai` SDK. The input is a STRUCTURAL {@link UIMessageLike} (id + role + parts), which the ai SDK's
 * `UIMessage` satisfies 1:1 — so a consumer of TheoKit's unified agent client passes `useAgent().thread`
 * straight through without importing `ai`. Pure functions, no React, no Ink.
 */
import type { AgentEvent, AgentToolEvent } from "./agent-event.js";
import { routeToolResult } from "./agent-stream-event.js";
import type { ChatThreadMessage } from "./chat-thread.js";
import type { ToolCallStatus } from "./tool-call.js";

/** A message part, read structurally — a `text`/`reasoning` block or a tool invocation. */
export interface UIMessagePartLike {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/** The minimal message shape the renderers read. The ai SDK's `UIMessage` is assignable to this. */
export interface UIMessageLike {
  id: string;
  role: "user" | "assistant" | "system";
  parts: readonly UIMessagePartLike[];
  /** Per-turn metadata the agent stream rides on the finish chunk (usage/cost) — read by {@link readTurnUsage}. */
  metadata?: unknown;
}

/**
 * Per-turn usage extracted from a message's {@link UIMessageLike.metadata} — the totals the agent stream
 * attaches to the finish chunk's `messageMetadata` (and `readUIMessageStream` lands on `UIMessage.metadata`).
 * Optional fields are OMITTED when the provider/agent did not report them (never fabricated as 0).
 */
export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** Total cost in USD for the turn (present iff the agent reported it). */
  cost?: number;
  durationMs?: number;
}

const USAGE_TOKEN_KEYS = [
  "reasoningTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
] as const;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * Read the per-turn usage from a message's metadata, or `undefined` when absent/malformed. Structural and
 * DEFENSIVE (never throws): a user turn, a run that ended without `done`, or a foreign metadata shape all
 * yield `undefined`. The three required token counts must be finite numbers; optional buckets/cost/duration
 * are copied only when finite. This is the seam a status bar / cost meter renders — see {@link TurnUsage}.
 */
export function readTurnUsage(message: UIMessageLike): TurnUsage | undefined {
  const metadata = message.metadata;
  if (!isRecord(metadata)) return undefined;
  const usage = metadata.usage;
  if (!isRecord(usage)) return undefined;
  if (
    !isFiniteNumber(usage.inputTokens) ||
    !isFiniteNumber(usage.outputTokens) ||
    !isFiniteNumber(usage.totalTokens)
  ) {
    return undefined;
  }
  const out: TurnUsage = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };
  for (const key of USAGE_TOKEN_KEYS) {
    const value = usage[key];
    if (isFiniteNumber(value)) out[key] = value;
  }
  if (isFiniteNumber(metadata.cost)) out.cost = metadata.cost;
  if (isFiniteNumber(metadata.durationMs)) out.durationMs = metadata.durationMs;
  return out;
}

/**
 * A gated tool paused awaiting a human decision — surfaced by {@link findPendingApproval} from a
 * reconstructed `approval-requested` tool part, so a surface renders an approval prompt and settles it
 * via the agent client's `approve(approvalId, decision)`.
 */
export interface PendingApproval {
  /** The id to settle: `useAgent().approve(approvalId, decision)`. */
  approvalId: string;
  /** The tool the human is being asked to allow (e.g. `send_email`). */
  toolName: string;
  /** The tool input the model proposed (shown to the approver). */
  input?: unknown;
}

/**
 * Scan a thread for a tool part awaiting human approval (`state === "approval-requested"`), newest first,
 * and surface its {@link PendingApproval}. `undefined` when none is pending (settled, or never gated).
 * Structural + DEFENSIVE (never throws): mirrors ai-sdk's reconstruction — `approval.id` (else the
 * `toolCallId`) is the settle id; `toolName`/`input` come off the same part.
 */
/** The settle id: `approval.id`, else the `toolCallId`, else none. */
function resolveApprovalId(p: Record<string, unknown>): string | undefined {
  const approval = p.approval as { id?: unknown } | undefined;
  if (typeof approval?.id === "string") return approval.id;
  if (typeof p.toolCallId === "string") return p.toolCallId;
  return undefined;
}

/** Read a single part as a {@link PendingApproval}, or `undefined` when it is
 * not an approval-requested tool part with a settle id. */
function partToPendingApproval(part: unknown): PendingApproval | undefined {
  const p = part as Record<string, unknown>;
  if (p.state !== "approval-requested") return undefined;
  const approvalId = resolveApprovalId(p);
  if (approvalId === undefined) return undefined;
  const result: PendingApproval = {
    approvalId,
    toolName: typeof p.toolName === "string" ? p.toolName : "tool",
  };
  if (p.input !== undefined) result.input = p.input;
  return result;
}

export function findPendingApproval(
  messages: readonly UIMessageLike[],
): PendingApproval | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i]?.parts ?? [];
    for (const part of parts) {
      const pending = partToPendingApproval(part);
      if (pending !== undefined) return pending;
    }
  }
  return undefined;
}

/** ai SDK tool-part `state` → tui {@link ToolCallStatus}. Approval-pending states read as `pending`. */
const TOOL_STATUS: Readonly<Record<string, ToolCallStatus>> = {
  "input-streaming": "pending",
  "input-available": "running",
  "approval-requested": "pending",
  "approval-responded": "pending",
  "output-available": "success",
  "output-error": "failed",
};

interface ToolPartView {
  toolCallId: string;
  toolName: string;
  state: string;
  output?: unknown;
  errorText?: string;
  input?: unknown;
}

/** Read the tool view from a part, or `null` when the part is not a tool invocation. */
function toolView(part: UIMessagePartLike): ToolPartView | null {
  const isDynamic = part.type === "dynamic-tool";
  if (!isDynamic && !part.type.startsWith("tool-")) return null;
  const p = part as Record<string, unknown>;
  const toolCallId = typeof p.toolCallId === "string" ? p.toolCallId : "";
  const toolName = isDynamic
    ? typeof p.toolName === "string"
      ? p.toolName
      : "tool"
    : part.type.slice("tool-".length);
  const view: ToolPartView = {
    toolCallId,
    toolName,
    state: typeof p.state === "string" ? p.state : "",
    output: p.output,
  };
  if (typeof p.errorText === "string") view.errorText = p.errorText;
  if (p.input !== undefined) view.input = p.input;
  return view;
}

/**
 * What the timeline shows for a tool result: an inline `diff` (unified-diff
 * result — e.g. `apply_patch`), a `shell` envelope (labeled stderr, non-zero
 * exit badge), or plain `output`. `errorText` wins on failure. The SDK
 * serializes results to a JSON string, so a string that parses to a shell
 * envelope routes to `shell` (and to `diff` when its stdout is a clean unified
 * diff); a plain string (file/grep/dir listings) stays `output`. Routing logic
 * is shared with the stream reducer — see `routeToolResult`.
 */
function toolResultContent(
  tool: ToolPartView,
): Pick<AgentToolEvent, "output" | "shell" | "diff"> {
  if (tool.state === "output-error") {
    return tool.errorText !== undefined ? { output: tool.errorText } : {};
  }
  const { output } = tool;
  if (output === undefined) return {};
  return routeToolResult(output) ?? { output: JSON.stringify(output, null, 2) };
}

// App RESULT-body override (Codex parity): map a tool's raw result (the SDK serializes it to a JSON
// string) to a clean output/shell/diff, replacing the default `JSON.stringify` fallback — e.g. a
// `{ ok, output }` shell result renders the terminal output, not raw JSON. Display-only: the model
// already consumed the raw result. `undefined` keeps the default routing, so unmapped tools are
// unchanged. output/shell/diff are EXCLUSIVE, so the override replaces all three.
function applyResultOverride(
  event: AgentToolEvent,
  rawOutput: unknown,
  formatResult: ToolResultFormatter,
): AgentToolEvent {
  const body = formatResult(event, rawOutput);
  if (body === undefined) return event;
  const rest = { ...event };
  delete rest.output;
  delete rest.shell;
  delete rest.diff;
  return { ...rest, ...body };
}

function toToolEvent(
  tool: ToolPartView,
  messageId: string,
  index: number,
  formatHeader?: ToolHeaderFormatter,
  formatResult?: ToolResultFormatter,
): AgentToolEvent {
  let event: AgentToolEvent = {
    id:
      tool.toolCallId.length > 0 ? tool.toolCallId : `${messageId}::t${index}`,
    kind: "tool",
    name: tool.toolName,
    status: TOOL_STATUS[tool.state] ?? "pending",
    ...(hasKeys(tool.input) ? { input: tool.input } : {}),
    ...toolResultContent(tool),
  };
  if (formatResult !== undefined && tool.output !== undefined) {
    event = applyResultOverride(event, tool.output, formatResult);
  }
  // App HEADER override (Codex parity): swap the raw tool name for a human verb+target and drop the
  // JSON args summary. `undefined` leaves the event untouched — so unmapped/explore tools are unchanged.
  const header = formatHeader?.(event);
  if (header === undefined) return event;
  return {
    ...event,
    ...(header.name !== undefined ? { name: header.name } : {}),
    ...(header.summary !== undefined ? { summary: header.summary } : {}),
  };
}

/** A non-empty object input worth keeping for the explore summary (an empty
 * `{}` adds only noise, so it is dropped). */
function hasKeys(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

/** Read-only exploration tools whose consecutive runs collapse into a Codex-style
 * "Explored" block. An app whose tools are named differently sees NO change (its
 * events never match → never grouped) — the default is back-compatible. */
export const DEFAULT_EXPLORE_TOOLS: readonly string[] = [
  "read_file",
  "list_dir",
  "grep",
  "search_text",
  "git_diff",
  "glob",
];

/** A run of ≥ this many adjacent explore-tool events collapses into one block.
 * A lone read stays a normal card (Codex only collapses when it reduces noise). */
const EXPLORE_GROUP_MIN = 2;

/** Collapse consecutive successful/running read-only tool events into
 * `explored` groups. A failed explore stays a normal card so its error stays
 * visible; a non-tool event (message/thinking) breaks the run. */
function groupExploration(
  events: readonly AgentEvent[],
  explore: ReadonlySet<string>,
): AgentEvent[] {
  const out: AgentEvent[] = [];
  let run: AgentToolEvent[] = [];
  const flush = (): void => {
    if (run.length >= EXPLORE_GROUP_MIN) {
      const first = run[0] as AgentToolEvent;
      out.push({ id: `explored-${first.id}`, kind: "explored", tools: run });
    } else {
      out.push(...run);
    }
    run = [];
  };
  for (const ev of events) {
    const explorable =
      ev.kind === "tool" &&
      explore.has(ev.name) &&
      (ev.status === "success" || ev.status === "running");
    if (explorable) {
      run.push(ev);
    } else {
      flush();
      out.push(ev);
    }
  }
  flush();
  return out;
}

/**
 * Project messages onto the chat surface: one `ChatThreadMessage` per message that has text, its `content`
 * the concatenation of the message's text parts. Tool-only / reasoning-only turns produce no chat bubble.
 */
export function messagesToChatThread(
  messages: readonly UIMessageLike[],
): ChatThreadMessage[] {
  const out: ChatThreadMessage[] = [];
  for (const message of messages) {
    let content = "";
    for (const part of message.parts) {
      if (part.type === "text" && typeof part.text === "string")
        content += part.text;
    }
    if (content.length === 0) continue;
    out.push({ id: message.id, role: message.role, content });
  }
  return out;
}

/**
 * App-supplied hook to turn a raw tool call into a HUMAN header (Codex parity): `run_shell` → "Ran
 * node --test", `apply_patch` → "Edited tax.mjs (+1 -1)", etc. Return `{ name, summary }` to override
 * the header; return `undefined` to leave the raw tool name untouched (so tools the app does not map —
 * incl. the read-only ones that collapse into an `explored` block — are unaffected). The generic TUI
 * stays tool-agnostic; the app owns the verb+target vocabulary of its own tools.
 *
 * NOTE: explored grouping matches on the (possibly overridden) `name` — returning a `name` for a tool
 * listed in `exploreTools` opts that call OUT of the explored collapse (it renders as a normal card).
 */
export type ToolHeaderFormatter = (
  event: AgentToolEvent,
) => { name?: string; summary?: string } | undefined;

/**
 * Map a tool's RAW result to a Codex-style result body — the sibling of {@link ToolHeaderFormatter}.
 * The app owns how ITS OWN tools' results render: a structured result (the SDK serializes tool results
 * to a JSON string, so `rawResult` is usually that string) becomes a clean `output` (terminal text),
 * `shell` envelope, or inline `diff`, instead of the default raw-JSON dump. Return `undefined` to keep
 * the default routing, so unmapped tools are unchanged. **Display-only** — the model already consumed
 * the raw result during the turn; this changes only how the past result renders in the timeline.
 */
export type ToolResultFormatter = (
  event: AgentToolEvent,
  rawResult: unknown,
) => Pick<AgentToolEvent, "output" | "shell" | "diff"> | undefined;

export interface MessagesToEventsOptions {
  /** Tool names whose consecutive runs collapse into an `explored` block.
   * Defaults to {@link DEFAULT_EXPLORE_TOOLS}. Pass `[]` to disable grouping. */
  exploreTools?: Iterable<string>;
  /** Map a tool call to a Codex-style human header (see {@link ToolHeaderFormatter}). */
  formatToolHeader?: ToolHeaderFormatter;
  /** Map a tool's raw result to a Codex-style result body (see {@link ToolResultFormatter}). */
  formatToolResult?: ToolResultFormatter;
}

/**
 * Flatten messages into an ordered `AgentEvent[]` for `<AgentTimeline>`: each text part → a `message` event,
 * each reasoning part → a `thinking` event, each tool invocation → a `tool` event (status mapped from the
 * part `state`). Every id is unique. Non-renderable parts (file, source, step-start, data, custom) are skipped.
 * Consecutive read-only exploration tools (see {@link DEFAULT_EXPLORE_TOOLS}) collapse into a Codex-style
 * `explored` block — apps with differently-named tools are unaffected.
 */
/**
 * Cache dos eventos derivados de UMA mensagem, chaveado pela identidade da própria mensagem.
 *
 * M92 — a derivação rodava inteira a cada chamada, e a chamada acontece por delta de token. O M86
 * mediu o custo: **3,274 ms @400 mensagens**, dominado por tool calls (texto puro é plano, ~0,025 ms).
 * O consumidor memoizou a chamada (`useMemo`); aqui a função para de recomputar o que não mudou.
 *
 * `WeakMap` e não `Map`: a chave é a mensagem, e reter uma mensagem descartada seria vazamento numa
 * sessão longa — exatamente a classe de defeito que este milestone existe para fechar do outro lado.
 *
 * O ganho real não é só CPU: os eventos passam a ter **identidade estável por construção**. É isso que
 * torna a validação incremental de `assertValidEvents` não-vacua — sem este cache, cada render produz
 * objetos novos, o prefixo nunca casa e o caminho rápido nunca dispara. A revisão do M92 mediu: 0 de 5
 * renders. Os dois itens são um só mecanismo visto de dois lados.
 */
const cacheDeEventos = new WeakMap<
  object,
  { partes: readonly unknown[]; eventos: AgentEvent[] }
>();

/** Os eventos de uma mensagem, do cache quando as partes são as MESMAS por identidade. */
function eventosDaMensagem(
  message: UIMessageLike,
  opts: MessagesToEventsOptions | undefined,
  derivar: () => AgentEvent[],
): AgentEvent[] {
  // Só cacheia quando não há formatadores: eles são funções do chamador e podem mudar entre renders
  // sem que a mensagem mude. Cachear por identidade de função acrescentaria uma dimensão de chave para
  // um caso que o consumidor não exercita (os formatadores dele são estáveis por módulo).
  if (
    opts?.formatToolHeader !== undefined ||
    opts?.formatToolResult !== undefined
  )
    return derivar();
  const chave = message as unknown as object;
  const anterior = cacheDeEventos.get(chave);
  if (
    anterior !== undefined &&
    anterior.partes.length === message.parts.length &&
    anterior.partes.every((p, i) => p === message.parts[i])
  ) {
    return anterior.eventos;
  }
  const eventos = derivar();
  cacheDeEventos.set(chave, { partes: [...message.parts], eventos });
  return eventos;
}

export function messagesToAgentEvents(
  messages: readonly UIMessageLike[],
  opts?: MessagesToEventsOptions,
): AgentEvent[] {
  const events: AgentEvent[] = [];
  for (const message of messages) {
    const doCache = eventosDaMensagem(message, opts, () =>
      derivarUmaMensagem(message, opts),
    );
    events.push(...doCache);
  }
  const explore0 = new Set(opts?.exploreTools ?? DEFAULT_EXPLORE_TOOLS);
  return explore0.size === 0 ? events : groupExploration(events, explore0);
}

/** A derivação de UMA mensagem — extraída para que o cache tenha o que memoizar. */
function derivarUmaMensagem(
  message: UIMessageLike,
  opts: MessagesToEventsOptions | undefined,
): AgentEvent[] {
  const events: AgentEvent[] = [];
  {
    message.parts.forEach((part, index) => {
      if (part.type === "text") {
        if (typeof part.text === "string" && part.text.length > 0) {
          events.push({
            id: `${message.id}::m${index}`,
            kind: "message",
            role: message.role,
            text: part.text,
          });
        }
        return;
      }
      if (part.type === "reasoning") {
        if (typeof part.text === "string" && part.text.length > 0) {
          events.push({
            id: `${message.id}::r${index}`,
            kind: "thinking",
            text: part.text,
          });
        }
        return;
      }
      const tool = toolView(part);
      if (tool !== null)
        events.push(
          toToolEvent(
            tool,
            message.id,
            index,
            opts?.formatToolHeader,
            opts?.formatToolResult,
          ),
        );
    });
  }
  return events;
}
