import { Box, Text, useStdout } from "ink";
import stringWidth from "string-width";

import { computeTableLayout } from "./markdown-table.js";
import type { MarkdownNode, TableAlign } from "./markdown.js";

/** Pad `text` to `width` cells per alignment (string-width aware). */
function padCell(text: string, width: number, align: TableAlign): string {
  const gap = Math.max(0, width - stringWidth(text));
  if (align === "right") return " ".repeat(gap) + text;
  if (align === "center") {
    const left = Math.floor(gap / 2);
    return " ".repeat(left) + text + " ".repeat(gap - left);
  }
  return text + " ".repeat(gap);
}

/** A box-drawing horizontal border line (`left … junction … right`). */
function borderLine(
  widths: number[],
  left: string,
  mid: string,
  right: string,
): string {
  return left + widths.map((w) => "─".repeat(w + 2)).join(mid) + right;
}

/** One grid data row: `│ cell │ cell │`. */
function gridRow(
  cells: string[],
  widths: number[],
  align: TableAlign[],
): string {
  const body = widths
    .map((w, i) => ` ${padCell(cells[i] ?? "", w, align[i] ?? "left")} `)
    .join("│");
  return `│${body}│`;
}

/** A markdown table: a bordered grid when it fits `columns`, else aligned
 * plain text (which ink wraps — no data loss, no overflow). */
export function Table({
  node,
}: {
  node: Extract<MarkdownNode, { kind: "table" }>;
}) {
  const { stdout } = useStdout();
  const budget = stdout?.columns ?? 80;
  const { widths, degrade } = computeTableLayout(
    node.header,
    node.rows,
    budget,
  );
  if (degrade) {
    // Space-separated cells; ink wraps a long row across visual lines.
    const rowText = (cells: string[]): string => cells.join("  ");
    return (
      <Box flexDirection="column">
        <Text bold wrap="wrap">
          {rowText(node.header)}
        </Text>
        {node.rows.map((row, index) => (
          <Text key={`tr-${index}`} wrap="wrap">
            {rowText(row)}
          </Text>
        ))}
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      <Text>{borderLine(widths, "┌", "┬", "┐")}</Text>
      <Text bold>{gridRow(node.header, widths, node.align)}</Text>
      <Text>{borderLine(widths, "├", "┼", "┤")}</Text>
      {node.rows.map((row, index) => (
        <Text key={`tr-${index}`}>{gridRow(row, widths, node.align)}</Text>
      ))}
      <Text>{borderLine(widths, "└", "┴", "┘")}</Text>
    </Box>
  );
}

/** Renders one block node. */
