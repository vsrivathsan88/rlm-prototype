/**
 * Maps line numbers (from backend annotations) to ProseMirror document positions.
 *
 * The backend LLM sees the document as plain text where each paragraph/heading
 * is a separate "line." This utility walks the ProseMirror document tree and
 * assigns sequential 1-based line numbers to top-level block nodes.
 */

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface LineRange {
  line: number;
  from: number; // ProseMirror position (start of block content)
  to: number;   // ProseMirror position (end of block content)
}

/**
 * Build a mapping from 1-based line numbers to ProseMirror positions.
 * Each top-level block node (paragraph, heading, list, etc.) = one "line."
 */
export function buildLineMap(doc: ProseMirrorNode): LineRange[] {
  const lines: LineRange[] = [];
  let lineNumber = 1;

  doc.forEach((node, offset) => {
    // offset is relative to doc content start
    // Absolute position: offset + 1 (doc node itself takes position 0)
    const from = offset + 1;
    // nodeSize includes opening + closing tokens, so content ends at from + nodeSize - 2
    const to = from + node.nodeSize - 2;

    lines.push({
      line: lineNumber,
      from,
      to: Math.max(from, to),
    });

    lineNumber++;
  });

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
