"use client";

import { useState } from "react";
import type { ReviewResultFE } from "@/lib/store";
import type { ReviewerColor } from "@/lib/reviewer-colors";

interface ReviewerCardProps {
  result: ReviewResultFE;
  isVisible: boolean;
  isRunning: boolean;
  onToggleVisibility: () => void;
  onRun: () => void;
  onAnnotationClick: (annotationId: string) => void;
  activeAnnotationId: string | null;
}

const decisionLabels: Record<string, { label: string; className: string }> = {
  pass: { label: "Pass", className: "badge-green" },
  pass_with_warnings: { label: "Pass with warnings", className: "badge-amber" },
  fail: { label: "Fail", className: "badge-red" },
};

function SeverityIcon({ severity, color }: { severity: string; color: ReviewerColor }) {
  if (severity === "critical" || severity === "warning") {
    return (
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold flex-shrink-0"
        style={{
          color: color.underline,
          background: color.bg,
          border: `1.5px solid ${color.underline}`,
        }}
      >
        !
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] flex-shrink-0"
      style={{
        color: color.underline,
        background: color.bg,
        border: `1px solid ${color.underline}`,
        opacity: 0.7,
      }}
    >
      i
    </span>
  );
}

export function ReviewerCard({
  result,
  isVisible,
  isRunning,
  onToggleVisibility,
  onRun,
  onAnnotationClick,
  activeAnnotationId,
}: ReviewerCardProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const decision = decisionLabels[result.decision] ?? decisionLabels.pass;

  return (
    <div
      className="feedback-card animate-slide-up"
      style={{
        borderLeftColor: result.color.underline,
        opacity: isVisible ? 1 : 0.55,
      }}
    >
      {/* Header: color dot + name + controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: result.color.underline }}
          />
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {result.judgeName}
          </span>
        </div>

        {/* Controls: play + eye + score */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Play / re-run button */}
          <button
            onClick={onRun}
            disabled={isRunning}
            className="p-1 rounded hover:bg-[var(--interactive-hover)] transition-colors disabled:opacity-40"
            title="Re-run this reviewer"
          >
            {isRunning ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                <path d="M21 12a9 9 0 11-6.22-8.56" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5,3 19,12 5,21 5,3" />
              </svg>
            )}
          </button>

          {/* Eye toggle */}
          <button
            onClick={onToggleVisibility}
            className="p-1 rounded hover:bg-[var(--interactive-hover)] transition-colors"
            title={isVisible ? "Hide annotations" : "Show annotations"}
          >
            {isVisible ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>

          {/* Score */}
          <span className="text-xs font-mono font-semibold text-[var(--text-secondary)] ml-1">
            {result.score.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Decision badge */}
      <div className="mb-3">
        <span className={`badge text-[10px] ${decision.className}`}>
          {decision.label}
        </span>
      </div>

      {/* Annotations list */}
      {result.annotations.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {result.annotations.map((ann) => (
            <button
              key={ann.id}
              onClick={() => onAnnotationClick(ann.id)}
              className={`
                w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-left
                transition-all text-xs
                ${ann.id === activeAnnotationId
                  ? "bg-[var(--interactive-active)]"
                  : "hover:bg-[var(--interactive-hover)]"
                }
              `}
            >
              <SeverityIcon severity={ann.severity} color={result.color} />
              <span className="flex-1 text-[var(--text-secondary)] leading-snug line-clamp-2">
                {ann.message}
              </span>
              <span className="text-[10px] font-mono text-[var(--text-tertiary)] whitespace-nowrap flex-shrink-0">
                L{ann.startLine}{ann.endLine !== ann.startLine ? `-${ann.endLine}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      {result.annotations.length === 0 && (
        <p className="text-xs text-[var(--text-tertiary)] mb-3">No issues found</p>
      )}

      {/* Footer: reasoning toggle */}
      <div className="flex items-center justify-end pt-2 border-t border-[var(--border-light)]">
        <button
          onClick={() => setShowReasoning(!showReasoning)}
          className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {showReasoning ? "Hide reasoning" : "Show reasoning"}
        </button>
      </div>

      {/* Expandable reasoning */}
      {showReasoning && (
        <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {result.reasoning}
          </p>
          {result.filesReferenced.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {result.filesReferenced.map((file) => (
                <span
                  key={file}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                >
                  {file}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
