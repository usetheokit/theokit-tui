import { Box, Static, Text } from "ink";
import { memo, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { AGENT_EVENT_KINDS, isAgentEventKind } from "./agent-event.js";
import type { AgentEvent, AgentToolEvent } from "./agent-event.js";
import { CHAT_ROLES, ChatMessage } from "./chat-message.js";
import { HEADER_SENTINEL_KEY } from "./chat-thread.js";
import { DiffViewer } from "./diff-viewer.js";
import {
  STATUS_INDICATOR_WIDTH,
  TOOL_CALL_STATUSES,
  ToolCallCard,
  formatToolName,
} from "./tool-call.js";
import { ToolResult } from "./tool-result.js";
import { useTheoTheme } from "./theme.js";
import { unionMessage } from "./union-message.js";
import type { LayoutMarginProps } from "./layout-props.js";

const KIND_UNION_MESSAGE = unionMessage(AGENT_EVENT_KINDS);

export interface AgentTimelineProps extends LayoutMarginProps {
  /**
   * Ordered agent events. ORDERING CONTRACT (plan ADR D2): caller-ordered
   * array; unique ids (duplicates throw); graduated events are IMMUTABLE —
   * replace the TAIL event with a new object to stream (rows are memoized by
   * object identity). Always pass a NEW array on update (in-place mutation of
   * the same reference has pinned-but-unsupported hybrid behavior — EC-8).
   */
  events: AgentEvent[];
  /**
   * Events beyond `windowSize + windowOverscan` graduate into Ink `<Static>`
   * (terminal scrollback) and are FROZEN. Mount-time tuning knobs: INCREASING
   * them after events have graduated pulls scrollback rows back into the live
   * tail, visibly duplicating history (M1 window-growth hazard — same wording
   * as ChatThread; D2 occurrence #2 of the windowing knowledge, Rule-of-3
   * extraction deferred until a third windowed surface exists).
   */
  windowSize?: number;
  windowOverscan?: number;
  /**
   * Optional header folded as the FIRST item of the timeline's own
   * `<Static>` — pinned above graduated history (M11; same MOUNT-TIME
   * freeze contract as ChatThread.header: later changes to content,
   * identity and presence are ignored; the id
   * `"__theokit_tui_header__"` is reserved). Size the header explicitly —
   * Static's box is content-sized/absolute; percentage widths may collapse.
   */
  header?: ReactElement;
}

const HEADER_SENTINEL = Symbol("theokit-tui-header");
type TimelineStaticItem = typeof HEADER_SENTINEL | AgentEvent;

/**
 * Structural boundary check (plan ADR D8, EC-1/EC-2): kind membership, id
 * uniqueness, role/status membership, output⊕shell exclusivity and maxLines
 * validity — child-component guards would fire mid-render where Ink's error
 * boundary swallows throws (F10) and name the wrong component. Primitive
 * FIELD TYPES are TypeScript's job (not re-checked at runtime — SEPA F5
 * scope note). Extra/unknown properties are tolerated (EC-12).
 */
function validateMessageEvent(
  event: Extract<AgentEvent, { kind: "message" }>,
): void {
  if (!CHAT_ROLES.includes(event.role)) {
    throw new TypeError(
      `AgentTimeline: message event "${event.id}" — invalid role "${String(event.role)}" — expected ${unionMessage(CHAT_ROLES)}`,
    );
  }
}

function validateToolEvent(event: Extract<AgentEvent, { kind: "tool" }>): void {
  if (!TOOL_CALL_STATUSES.includes(event.status)) {
    throw new TypeError(
      `AgentTimeline: tool event "${event.id}" — invalid status "${String(event.status)}" — expected ${unionMessage(TOOL_CALL_STATUSES)}`,
    );
  }
  const bodyCount =
    (event.output !== undefined ? 1 : 0) +
    (event.shell !== undefined ? 1 : 0) +
    (event.diff !== undefined ? 1 : 0);
  if (bodyCount > 1) {
    throw new TypeError(
      `AgentTimeline: tool event "${event.id}" — provide only one of output | shell | diff`,
    );
  }
  // SEPA F1: ToolResult's own maxLines guard would fire mid-render
  // (swallowed, wrong component name) — mirror it at THIS boundary.
  if (
    event.maxLines !== undefined &&
    (!Number.isInteger(event.maxLines) || event.maxLines < 1)
  ) {
    throw new TypeError(
      `AgentTimeline: tool event "${event.id}" — maxLines must be an integer >= 1 — got ${String(event.maxLines)}`,
    );
  }
}

/**
 * M92 — valida só a CAUDA quando o array novo é extensão de prefixo do anterior.
 *
 * `assertValidEvents` varria o histórico inteiro a **cada render** — incluindo as linhas já congeladas
 * em `<Static>`, que por construção não mudam. Numa sessão longa isso é trabalho O(N) por token sobre
 * dado que a própria estrutura garante imutável.
 *
 * "Extensão de prefixo" = `novo[i] === velho[i]` por identidade para todo `i < velho.length`. Quando é,
 * os ids já vistos são reaproveitados e só o resto é validado. Quando **não** é (reordenação, edição,
 * reset), cai no fallback de varredura completa — e é o fallback que garante que nenhum caso deixa de
 * ser validado, que é a razão de esta variante ter sido preferida a esconder a checagem atrás de
 * `NODE_ENV !== 'production'`: aquela desliga a validação exatamente onde o dado é real.
 */
const ultimaValidacao: { events: AgentEvent[]; ids: Set<string> } = {
  events: [],
  ids: new Set(),
};

/**
 * Exportado para teste porque a alternativa era pior.
 *
 * O throw de `assertValidEvents` acontece durante o render e o ink não o propaga para o chamador —
 * medido: `renderFrame` de um evento inválido **resolve**, não rejeita. Sem esta costura, a única
 * prova de que a otimização não deixou de validar seria leitura de código, que é exatamente o tipo de
 * evidência que esta base de código recusa.
 *
 * `reiniciarValidacaoIncremental` existe pelo mesmo motivo: o estado é de módulo, e um teste que não
 * consegue zerá-lo depende da ordem dos outros.
 */
export function reiniciarValidacaoIncremental(): void {
  ultimaValidacao.events = [];
  ultimaValidacao.ids = new Set();
}

export function assertValidEvents(events: AgentEvent[]): void {
  const anterior = ultimaValidacao.events;
  let inicio = 0;
  let seen: Set<string>;
  const ehExtensao =
    anterior.length > 0 &&
    events.length >= anterior.length &&
    anterior.every((e, i) => events[i] === e);
  if (ehExtensao) {
    inicio = anterior.length;
    seen = new Set(ultimaValidacao.ids);
  } else {
    seen = new Set<string>();
  }
  for (const event of events.slice(inicio)) {
    if (event.id === HEADER_SENTINEL_KEY) {
      throw new TypeError(
        `AgentTimeline: event id "${HEADER_SENTINEL_KEY}" collides with the reserved header sentinel key`,
      );
    }
    if (!isAgentEventKind(event.kind)) {
      throw new TypeError(
        `AgentTimeline: unknown event kind "${String(event.kind)}" — expected ${KIND_UNION_MESSAGE}`,
      );
    }
    if (seen.has(event.id)) {
      throw new TypeError(`AgentTimeline: duplicate event id "${event.id}"`);
    }
    seen.add(event.id);
    if (event.kind === "message") {
      validateMessageEvent(event);
    }
    if (event.kind === "tool") {
      validateToolEvent(event);
    }
  }
  // Só grava DEPOIS de validar tudo: um array que lançou não pode virar prefixo confiável, senão o
  // próximo render pularia a checagem que acabou de falhar.
  ultimaValidacao.events = events;
  ultimaValidacao.ids = seen;
}

// Column note (SEPA F6, accepted heritage): message rows use ChatMessage's
// 2-cell "✦ " prefix while thinking/tool rows use the 3-cell indicator —
// same mixed-prefix shape as the gemini timeline; aligning would change the
// M0/M1 public render. Revisit with the M6 theme system.
function ThinkingRow({ text }: { text: string }) {
  const theme = useTheoTheme();
  return (
    <Box>
      <Box minWidth={STATUS_INDICATOR_WIDTH}>
        {/* U+2022 (EAW-Narrow), distinct from the system role's "·" — under
            NO_COLOR the glyph is the ONLY thinking marker (dom-frontend-2;
            codex ReasoningSummaryCell precedent). */}
        <Text color={theme.role.system.prefix}>•</Text>
      </Box>
      <Text dimColor italic>
        {text}
      </Text>
    </Box>
  );
}

// SEPA F2: pass `output` as ToolResult CHILDREN (not pre-split lines) so
// it inherits M2's normalization — CRLF strip (EC-6), trailing-blank pop
// (EC-7). Empty output collapses to the bare row (`null` and `false` are
// equally non-renderable to ToolCallCard's hasRenderableBody).
function toolBody(event: Extract<AgentEvent, { kind: "tool" }>) {
  const maxLines =
    event.maxLines !== undefined ? { maxLines: event.maxLines } : {};
  // A unified-diff result (e.g. apply_patch) renders as a Claude-Code-style
  // inline diff (row backgrounds + prose stats + syntax highlight — the card
  // header already names the tool/file); everything else goes through
  // ToolResult (output / shell modes).
  if (event.diff !== undefined && event.diff !== "") {
    return <DiffViewer patch={event.diff} background {...maxLines} />;
  }
  const hasBody =
    (event.output !== undefined && event.output !== "") ||
    event.shell !== undefined;
  if (!hasBody) return null;
  return (
    <ToolResult
      {...(event.output !== undefined ? { children: event.output } : {})}
      {...(event.shell !== undefined ? { shell: event.shell } : {})}
      {...maxLines}
    />
  );
}

function ToolRow(event: Extract<AgentEvent, { kind: "tool" }>) {
  return (
    <ToolCallCard
      name={event.name}
      status={event.status}
      {...(event.summary !== undefined ? { summary: event.summary } : {})}
    >
      {toolBody(event)}
    </ToolCallCard>
  );
}

interface ExploreArgs {
  path: string | undefined;
  pattern: string | undefined;
}

const searchLabel = ({ pattern }: ExploreArgs): string =>
  pattern !== undefined ? `Search "${pattern}"` : "Search";

/** Per-tool label formatters for the Explored block (extracted from a switch
 * to keep exploreSummary within the complexity gate). */
const EXPLORE_LABELS: Record<string, (args: ExploreArgs) => string> = {
  read_file: ({ path }) => (path !== undefined ? `Read ${path}` : "Read"),
  list_dir: ({ path }) => `List ${path ?? "."}`,
  grep: searchLabel,
  search_text: searchLabel,
  git_diff: () => "Diff",
  glob: ({ pattern }) => (pattern !== undefined ? `Glob ${pattern}` : "Glob"),
};

/** A Codex-style verb+target label for one explored tool ("Read config.mjs",
 * "List agents/tools", 'Search "pattern"'), derived from its input. */
function exploreSummary(tool: AgentToolEvent): string {
  const input = (tool.input ?? {}) as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof input[key] === "string" ? (input[key] as string) : undefined;
  const args: ExploreArgs = {
    path: str("path") ?? str("file") ?? str("dir"),
    pattern: str("pattern") ?? str("query") ?? str("regex"),
  };
  const label = EXPLORE_LABELS[tool.name];
  if (label !== undefined) return label(args);
  // PascalCase display standard for the raw-name fallback (same rule as the
  // ToolCall header — an unmapped explore tool never shows snake_case).
  return args.path ?? args.pattern ?? formatToolName(tool.name);
}

/** A run of read-only exploration collapsed into one "Explored" block (Codex
 * parity): a header + one dim verb+target line per tool, outputs summarized
 * away so exploration does not dominate the transcript. */
function ExploredBlock({ tools }: { tools: readonly AgentToolEvent[] }) {
  const theme = useTheoTheme();
  const token = theme.toolStatus.success;
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={token.color}>
          {token.glyph.padEnd(STATUS_INDICATOR_WIDTH)}
        </Text>
        <Text bold>Explored</Text>
        <Text dimColor>{` (${tools.length})`}</Text>
      </Box>
      {tools.map((tool) => (
        <Text key={tool.id} dimColor>
          {`  └ ${exploreSummary(tool)}`}
        </Text>
      ))}
    </Box>
  );
}

function eventRow(event: AgentEvent) {
  switch (event.kind) {
    case "explored":
      return <ExploredBlock tools={event.tools} />;
    case "message":
      // Claude Code parity: an assistant turn is Markdown (headings, lists, fenced code → CodeBlock with
      // syntax highlight), so render it through MarkdownText. The user echo stays raw (dim) — a user's typed
      // input is not Markdown source; rendering it as such would mangle a literal `#` or `*`.
      return (
        <ChatMessage role={event.role} markdown={event.role === "assistant"}>
          {event.text}
        </ChatMessage>
      );
    case "thinking":
      return <ThinkingRow text={event.text} />;
    case "tool":
      return <ToolRow {...event} />;
    default: {
      // Unreachable through the public API — assertValidEvents screens kinds
      // at the boundary (D8); kept for compile-time exhaustiveness (D3).
      /* v8 ignore next 6 */
      const exhaustive: never = event;
      throw new TypeError(
        `AgentTimeline: unknown event kind "${String((exhaustive as AgentEvent).kind)}" — expected ${KIND_UNION_MESSAGE}`,
      );
    }
  }
}

const Row = memo(
  ({ event, spaced }: { event: AgentEvent; spaced: boolean }) => (
    // Claude Code cadence: one blank line above every block EXCEPT the first
    // rendered one — the transcript breathes (mirrors ChatThread's spacing).
    <Box marginTop={spaced ? 1 : 0} flexDirection="column">
      {eventRow(event)}
    </Box>
  ),
  (prev, next) => prev.event === next.event && prev.spaced === next.spaced,
);
Row.displayName = "AgentTimeline.Row";

/**
 * Ordered agent-turn timeline mixing messages, thinking and tool events
 * (plan ADR D2 — sibling of ChatThread: windowed `<Static>` history +
 * identity-memoized rows + its own kind dispatch).
 *
 * ONE TIMELINE (or ChatThread) PER SCREEN once history graduates: two
 * mounted `<Static>` consumers cannot interleave their frozen output — rows
 * print partitioned by component, not by time (D2 rationale; wire-3).
 * Composing both is safe only while neither exceeds its window.
 */
export function AgentTimeline({
  events,
  windowSize = 8,
  windowOverscan = 4,
  header,
  ...margin
}: AgentTimelineProps) {
  // Boundary validation FIRST, before any hook (F10 — tests invoke this as a
  // plain function; Ink swallows render-time throws).
  assertValidEvents(events);
  // MOUNT-FREEZE (M11 D1 — mirrors ChatThread): constant length
  // contribution; ink Static advances its index by LENGTH only.
  const frozenHeader = useRef(header).current;
  const tailStart = Math.max(
    0,
    events.length - Math.max(0, windowSize) - Math.max(0, windowOverscan),
  );
  const prefix = useMemo(() => events.slice(0, tailStart), [events, tailStart]);
  const items = useMemo<TimelineStaticItem[]>(
    () => (frozenHeader === undefined ? prefix : [HEADER_SENTINEL, ...prefix]),
    [frozenHeader, prefix],
  );
  const tail = events.slice(tailStart);

  return (
    <>
      {items.length > 0 && (
        <Static items={items}>
          {(item, index) =>
            item === HEADER_SENTINEL ? (
              <Box key={HEADER_SENTINEL_KEY} flexDirection="column">
                {frozenHeader}
              </Box>
            ) : (
              // Space every block except the first rendered element (index 0).
              <Row key={item.id} event={item} spaced={index > 0} />
            )
          }
        </Static>
      )}
      {/* Margin lands on the LIVE region. The `<Static>` history is append-only
          terminal scrollback and is not margined (a graduated row's position is
          frozen); the consumer margin spaces the timeline's on-screen tail. */}
      <Box flexDirection="column" {...margin}>
        {tail.map((event, index) => (
          // First tail block is the timeline's first ONLY when nothing graduated
          // into Static above it (items empty).
          <Row
            key={event.id}
            event={event}
            spaced={items.length > 0 || index > 0}
          />
        ))}
      </Box>
    </>
  );
}
