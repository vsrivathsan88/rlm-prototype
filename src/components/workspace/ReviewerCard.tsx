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

function summarizeReasoning(reasoning: string): string {
  const normalized = reasoning.trim();
  if (normalized.length <= 320) return normalized;
  return `${normalized.slice(0, 320)}...`;
}

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
  const [showAllAnnotations, setShowAllAnnotations] = useState(false);
  const decision = decisionLabels[result.decision] ?? decisionLabels.pass;
  const visibleAnnotations = showAllAnnotations ? result.annotations : result.annotations.slice(0, 3);
  const hiddenAnnotationCount = Math.max(0, result.annotations.length - visibleAnnotations.length);

  return (
    <div
      className="feedback-card animate-slide-up"
      style={{
        borderLeftColor: result.color.underline,
        opacity: isVisible ? 1 : 0.55,
      }}
    >
      {/* Header: color dot + name + score */}
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
        <span className="text-xs font-mono font-semibold text-[var(--text-secondary)] ml-1">
          {result.score.toFixed(1)}
        </span>
      </div>

      {/* Actions: clear labels for first-time users */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button
          onClick={onRun}
          disabled={isRunning}
          className="inline-flex h-7 items-center gap-1 rounded border border-[var(--zinc)] px-2 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--phosphor)]/40 disabled:opacity-40"
          aria-label={`Re-run ${result.judgeName}`}
        >
          {isRunning ? "Running..." : "Re-run"}
        </button>
        <button
          onClick={onToggleVisibility}
          className="inline-flex h-7 items-center gap-1 rounded border border-[var(--zinc)] px-2 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--phosphor)]/40"
          aria-label={isVisible ? `Hide ${result.judgeName} highlights` : `Show ${result.judgeName} highlights`}
        >
          {isVisible ? "Highlights On" : "Highlights Off"}
        </button>
        <button
          onClick={() => setShowReasoning(!showReasoning)}
          className="inline-flex h-7 items-center gap-1 rounded border border-[var(--zinc)] px-2 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--phosphor)]/40"
        >
          {showReasoning ? "Hide Summary" : "Show Summary"}
        </button>
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
          {visibleAnnotations.map((ann) => (
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
          {hiddenAnnotationCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllAnnotations(true)}
              className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              Show {hiddenAnnotationCount} more issue{hiddenAnnotationCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}

      {result.annotations.length === 0 && (
        <p className="text-xs text-[var(--text-tertiary)] mb-3">No issues found in this pass.</p>
      )}

      {/* Expandable reasoning summary */}
      {showReasoning && (
        <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {summarizeReasoning(result.reasoning)}
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
