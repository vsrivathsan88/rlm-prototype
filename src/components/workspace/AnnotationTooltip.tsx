"use client";

import { createPortal } from "react-dom";
import type { ReviewAnnotation } from "@/lib/store";
import type { ReviewerColor } from "@/lib/reviewer-colors";

interface AnnotationTooltipProps {
  annotation: ReviewAnnotation | null;
  judgeName: string;
  color: ReviewerColor;
  rect: DOMRect | null;
}

const severityStyles: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "var(--status-error-bg)", text: "var(--status-error)", label: "Critical" },
  warning: { bg: "var(--status-warning-bg)", text: "var(--status-warning)", label: "Warning" },
  info: { bg: "var(--status-info-bg)", text: "var(--status-info)", label: "Info" },
};

export function AnnotationTooltip({ annotation, judgeName, color, rect }: AnnotationTooltipProps) {
  if (!annotation || !rect) return null;

  const severity = severityStyles[annotation.severity] ?? severityStyles.info;

  // Position above the annotation, centered horizontally
  const style: React.CSSProperties = {
    top: rect.top - 8,
    left: rect.left + rect.width / 2,
    transform: "translate(-50%, -100%)",
  };

  // If tooltip would go off-screen top, show below instead
  if (rect.top < 120) {
    style.top = rect.bottom + 8;
    style.transform = "translate(-50%, 0)";
  }

  const tooltip = (
    <div className="annotation-tooltip" style={style}>
      <div className="annotation-tooltip-header">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: color.underline }}
        />
        <span style={{ color: color.underline }}>{judgeName}</span>
        <span
          className="annotation-tooltip-severity"
          style={{ background: severity.bg, color: severity.text }}
        >
          {severity.label}
        </span>
      </div>
      <p className="m-0 text-[13px] leading-snug">{annotation.message}</p>
      {annotation.criterion && (
        <p className="m-0 mt-1 text-[11px] text-[var(--text-tertiary)]">
          Criterion: {annotation.criterion}
        </p>
      )}
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(tooltip, document.body);
}
