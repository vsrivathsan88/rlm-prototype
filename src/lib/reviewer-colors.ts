/**
 * Color palette for reviewer annotations.
 * Each reviewer gets a unique color used for underlines, icons, and cards.
 * Colors chosen for legibility as underlines on light backgrounds.
 */

export type ReviewerColor = {
  id: string;
  underline: string;
  bg: string; // 8% opacity version for hover/active fills
  label: string;
};

export const REVIEWER_COLORS: ReviewerColor[] = [
  { id: "violet",  underline: "#7c3aed", bg: "rgba(124, 58, 237, 0.08)",  label: "Violet"  },
  { id: "rose",    underline: "#e11d48", bg: "rgba(225, 29, 72, 0.08)",   label: "Rose"    },
  { id: "teal",    underline: "#0d9488", bg: "rgba(13, 148, 136, 0.08)",  label: "Teal"    },
  { id: "amber",   underline: "#d97706", bg: "rgba(217, 119, 6, 0.08)",   label: "Amber"   },
  { id: "blue",    underline: "#2563eb", bg: "rgba(37, 99, 235, 0.08)",   label: "Blue"    },
  { id: "fuchsia", underline: "#c026d3", bg: "rgba(192, 38, 211, 0.08)", label: "Fuchsia" },
  { id: "emerald", underline: "#059669", bg: "rgba(5, 150, 105, 0.08)",  label: "Emerald" },
  { id: "orange",  underline: "#ea580c", bg: "rgba(234, 88, 12, 0.08)",  label: "Orange"  },
];

export function getReviewerColor(index: number): ReviewerColor {
  return REVIEWER_COLORS[index % REVIEWER_COLORS.length];
}

export function buildColorMap(judgeIds: string[]): Map<string, ReviewerColor> {
  const map = new Map<string, ReviewerColor>();
  judgeIds.forEach((id, i) => map.set(id, getReviewerColor(i)));
  return map;
}
