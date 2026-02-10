/**
 * Maps line numbers (from backend annotations) to ProseMirror document positions.
 *
 * The backend LLM sees the document as plain text where each text block
 * (paragraph, heading, list item paragraph) is a separate "line."
 * This utility walks the ProseMirror document tree and maps those lines
 * to concrete ProseMirror positions.
 */

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface LineRange {
  line: number;
  from: number; // ProseMirror position (start of block content)
  to: number;   // ProseMirror position (end of block content)
}

/**
 * Build a mapping from 1-based line numbers to ProseMirror positions.
 * Each textblock node (including nested list items) = one "line."
 */
export function buildLineMap(doc: ProseMirrorNode): LineRange[] {
  const lines: LineRange[] = [];
  let lineNumber = 1;

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;

    // For textblocks, content starts at pos + 1 and spans node.content.size.
    const from = pos + 1;
    const to = Math.max(from, pos + Math.max(1, node.content.size));

    lines.push({
      line: lineNumber,
      from,
      to,
    });
    lineNumber += 1;
    return true;
  });

  if (!lines.length) {
    lines.push({
      line: 1,
      from: 1,
      to: Math.max(1, doc.content.size),
    });
  }

  return lines;
}

/**
 * Convert a backend line range (1-based) to ProseMirror { from, to } positions.
 * Returns null if lines are out of range.
 */
export function linesToPositions(
  lineMap: LineRange[],
  startLine: number,
  endLine: number
): { from: number; to: number } | null {
  const startEntry = lineMap.find((l) => l.line === startLine);
  const endEntry = lineMap.find((l) => l.line === endLine);

  if (!startEntry) return null;

  return {
    from: startEntry.from,
    to: endEntry ? endEntry.to : startEntry.to,
  };
}
