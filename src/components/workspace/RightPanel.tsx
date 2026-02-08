"use client";

import { useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { ReviewerCard } from "@/components/workspace/ReviewerCard";
import type {
  Doer,
  Reviewer,
  ReviewResultFE,
  ReviewSummaryFE,
  RolloutHistoryEvent,
  ShadowReviewSnapshot,
} from "@/lib/store";
import { connectorLabel } from "@/lib/connectors";

interface RightPanelProps {
  syncStatus: "idle" | "syncing" | "done";
  connector: string | null;
  filesCount?: number;
  // Review props
  isReviewing?: boolean;
  reviewResults?: ReviewResultFE[];
  reviewSummary?: ReviewSummaryFE | null;
  activeAnnotationId?: string | null;
  visibleJudgeIds?: Set<string>;
  onRunReview?: () => void;
  onClearReview?: () => void;
  onRunSingleReview?: (judgeId: string) => void;
  runningJudgeId?: string | null;
  onAnnotationClick?: (annotationId: string) => void;
  onToggleJudgeVisibility?: (judgeId: string) => void;
  shadowReview?: ShadowReviewSnapshot;
  onRunShadowReview?: () => void;
  rolloutMode?: "baseline" | "shadow" | "active";
  rolloutHistory?: RolloutHistoryEvent[];
  onOpenRolloutHistory?: () => void;
  onRecoverToActive?: () => void;
  isRecoveringToActive?: boolean;
  onSetRolloutMode?: (mode: "baseline" | "shadow" | "active") => void;
  crewDoers?: Doer[];
  crewReviewers?: Reviewer[];
}

const skills = [
  { name: "Summarize sources", icon: "📑", shortcut: "⌘K" },
  { name: "GTM Clarity Lens", icon: "🔍", shortcut: "⌘L" },
  { name: "Launch readiness", icon: "🎯", shortcut: "⌘R" },
];

function formatRolloutTime(value?: string): string {
  if (!value) return "unknown time";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rolloutSourceLabel(source: RolloutHistoryEvent["source"]): string {
  if (source === "auto_fallback") return "auto fallback";
  if (source === "manual") return "manual change";
  if (source === "migration") return "legacy migration";
  if (source === "hydrate") return "state hydration";
  return "project init";
}

function deterministicEmoji(seed: string, pool: string[]): string {
  if (!pool.length) return "AI";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

function crewEmoji(id: string, name: string, kind: "doer" | "reviewer"): string {
  if (kind === "doer") {
    return deterministicEmoji(`${id}:${name}`, ["🧭", "🛠️", "🚀", "🧠", "📐", "⚙️"]);
  }
  return deterministicEmoji(`${id}:${name}`, ["🔍", "🧪", "🛡️", "📏", "🧾", "🧠"]);
}

function summarizeCrewRole(
  member: Pick<Doer, "specialty" | "description"> | Pick<Reviewer, "reason" | "description">,
  kind: "doer" | "reviewer"
): string {
  if (kind === "doer") {
    const doer = member as Pick<Doer, "specialty" | "description">;
    return doer.specialty || doer.description || "Executes project tasks";
  }
  const reviewer = member as Pick<Reviewer, "reason" | "description">;
  return reviewer.reason || reviewer.description || "Reviews output quality";
}

export function RightPanel({
  syncStatus,
  connector,
  filesCount = 0,
  isReviewing = false,
  reviewResults = [],
  reviewSummary,
  activeAnnotationId,
  visibleJudgeIds = new Set(),
  onRunReview,
  onClearReview,
  onRunSingleReview,
  runningJudgeId = null,
  onAnnotationClick,
  onToggleJudgeVisibility,
  shadowReview,
  onRunShadowReview,
  rolloutMode = "baseline",
  rolloutHistory = [],
  onOpenRolloutHistory,
  onRecoverToActive,
  isRecoveringToActive = false,
  onSetRolloutMode,
  crewDoers = [],
  crewReviewers = [],
}: RightPanelProps) {
  const hasResults = reviewResults.length > 0;
  const connectorName = connectorLabel(connector);
  const rolloutEvents = rolloutHistory.slice(-5).reverse();
  const latestAutoFallback = rolloutEvents.find((event) => event.source === "auto_fallback");
  const enabledDoers = crewDoers.filter((member) => member.enabled);
  const enabledCrewReviewers = crewReviewers.filter((member) => member.enabled);
  const [expandedCrewItem, setExpandedCrewItem] = useState<string | null>(null);
  const reviewerResultById = new Map(reviewResults.map((result) => [result.judgeId, result]));

  return (
    <div className="w-72 flex-shrink-0 border-l border-[var(--glass-border)] bg-[var(--carbon)]/50 flex flex-col overflow-hidden">
      {/* Sync Status */}
      <Panel
        className="border-0 border-b border-[var(--glass-border)]"
        header={
          <PanelHeader
            title="Files"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            }
            action={
              <StatusIndicator
                status={syncStatus === "done" ? "ready" : syncStatus === "syncing" ? "syncing" : "idle"}
              />
            }
          />
        }
      >
        {syncStatus === "idle" && !connector && (
          <div className="text-center py-4">
            <div className="text-[var(--ash)] text-xs mb-2">No connector selected</div>
            <div className="text-[10px] text-[var(--zinc)]">Choose a source to start syncing</div>
          </div>
        )}

        {syncStatus === "syncing" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot-syncing" />
              <span className="text-xs text-[var(--amber)]">
                Gathering files from {connectorName}...
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-[var(--smoke)]">Files found</span>
                <span className="text-[var(--pearl)]">{filesCount}</span>
              </div>
              <div className="h-1 bg-[var(--graphite)] overflow-hidden">
                <div
                  className="h-full bg-[var(--amber)] transition-all animate-pulse-glow"
                  style={{ width: "60%" }}
                />
              </div>
            </div>
            <div className="text-[10px] font-mono text-[var(--ash)]">
              We&apos;ll ping you when ready
            </div>
          </div>
        )}

        {syncStatus === "done" && (
          <div className="space-y-3">
            {filesCount > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="status-dot status-dot-ready" />
                    <span className="text-xs text-[var(--phosphor)]">
                      All set!
                    </span>
                  </div>
                  <Badge variant="phosphor">{filesCount} {filesCount === 1 ? 'file' : 'files'}</Badge>
                </div>
                <div className="text-[10px] font-mono text-[var(--smoke)]">
                  Press Cmd+K to start
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="text-[var(--ash)] text-xs mb-2">No files found</div>
                <div className="text-[10px] text-[var(--zinc)]">
                  Connect a folder with documents to get started
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Crew */}
      <Panel
        className="border-0 border-b border-[var(--glass-border)] max-h-[40vh] overflow-auto"
        header={
          <PanelHeader
            title="Crew"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path d="M20 8v6M23 11h-6" />
              </svg>
            }
          />
        }
      >
        {enabledDoers.length === 0 && enabledCrewReviewers.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-[var(--ash)] text-xs mb-1">No crew assigned yet</div>
            <div className="text-[10px] text-[var(--zinc)]">Generate doers and reviewers in project setup</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-[var(--phosphor)]/30 bg-[var(--phosphor-glow)] px-2 py-1.5 text-[10px] text-[var(--smoke)]">
              Crew stack: {enabledDoers.length} doer{enabledDoers.length === 1 ? "" : "s"} +{" "}
              {enabledCrewReviewers.length} reviewer{enabledCrewReviewers.length === 1 ? "" : "s"}
            </div>

            <div>
              <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">Reviewers</div>
              <div className="space-y-1.5">
                {enabledCrewReviewers.length === 0 ? (
                  <p className="text-[10px] text-[var(--ash)]">No active reviewers.</p>
                ) : (
                  enabledCrewReviewers.map((reviewer) => (
                    <div
                      key={reviewer.id}
                      className="rounded-md border border-[var(--zinc)]/40 bg-[var(--graphite)] px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCrewItem((current) =>
                              current === `reviewer:${reviewer.id}` ? null : `reviewer:${reviewer.id}`
                            )
                          }
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[var(--zinc)]/70 bg-[var(--carbon)] text-sm">
                            {crewEmoji(reviewer.id, reviewer.name, "reviewer")}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs text-[var(--pearl)]">{reviewer.name}</span>
                            <span className="block truncate text-[10px] text-[var(--ash)]">
                              {summarizeCrewRole(reviewer, "reviewer")}
                            </span>
                          </span>
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onRunSingleReview?.(reviewer.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--zinc)]/80 bg-[var(--carbon)] text-[var(--smoke)] hover:border-[var(--phosphor)]/40 hover:text-[var(--phosphor)]"
                            aria-label={`Run ${reviewer.name} review`}
                            title={`Run ${reviewer.name}`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="5,3 19,12 5,21 5,3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleJudgeVisibility?.(reviewer.id)}
                            className="inline-flex h-7 items-center gap-1 rounded border border-[var(--zinc)]/80 bg-[var(--carbon)] px-1.5 text-[10px] text-[var(--smoke)] hover:border-[var(--phosphor)]/40 hover:text-[var(--phosphor)]"
                            aria-label={`${visibleJudgeIds.has(reviewer.id) ? "Hide" : "Show"} ${reviewer.name} highlights`}
                            title={visibleJudgeIds.has(reviewer.id) ? "Hide highlights" : "Show highlights"}
                          >
                            {visibleJudgeIds.has(reviewer.id) ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>
                      {expandedCrewItem === `reviewer:${reviewer.id}` && (
                        <div className="mt-2 border-t border-[var(--zinc)]/50 pt-2">
                          <p className="text-[10px] leading-relaxed text-[var(--smoke)]">
                            {reviewer.description || reviewer.reason}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--ash)]">
                            <span>Strictness: {reviewer.strictness || "medium"}</span>
                            {reviewerResultById.get(reviewer.id) && (
                              <span>
                                Score {reviewerResultById.get(reviewer.id)?.score.toFixed(1)} ·{" "}
                                {reviewerResultById.get(reviewer.id)?.annotations.length || 0} highlights
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">Doers</div>
              <div className="space-y-1.5">
                {enabledDoers.length === 0 ? (
                  <p className="text-[10px] text-[var(--ash)]">No active doers.</p>
                ) : (
                  enabledDoers.map((doer) => (
                    <div
                      key={doer.id}
                      className="rounded-md border border-[var(--zinc)]/40 bg-[var(--graphite)] px-2 py-1.5"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCrewItem((current) =>
                            current === `doer:${doer.id}` ? null : `doer:${doer.id}`
                          )
                        }
                        className="flex w-full items-center gap-2 text-left"
                      >
                        <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[var(--zinc)]/70 bg-[var(--carbon)] text-sm">
                          {crewEmoji(doer.id, doer.name, "doer")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-[var(--pearl)]">{doer.name}</span>
                          <span className="block truncate text-[10px] text-[var(--ash)]">
                            {summarizeCrewRole(doer, "doer")}
                          </span>
                        </span>
                      </button>
                      {expandedCrewItem === `doer:${doer.id}` && (
                        <div className="mt-2 border-t border-[var(--zinc)]/50 pt-2">
                          <p className="text-[10px] leading-relaxed text-[var(--smoke)]">{doer.description}</p>
                          <div className="mt-1 text-[10px] text-[var(--ash)]">
                            Strictness: {doer.strictness || "medium"}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* Reviewers */}
      <Panel
        className="border-0 border-b border-[var(--glass-border)] flex-1 overflow-auto"
        header={
          <PanelHeader
            title="Review Results"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M9 15l2 2 4-4" />
              </svg>
            }
            action={
              hasResults ? (
                <Button variant="ghost" size="sm" onClick={onClearReview}>
                  Clear
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRunReview}
                  disabled={isReviewing}
                >
                  {isReviewing ? (
                    <span className="flex items-center gap-1.5">
                      <span className="status-dot status-dot-working w-1.5 h-1.5" />
                      Reviewing...
                    </span>
                  ) : (
                    "Run Review"
                  )}
                </Button>
              )
            }
          />
        }
      >
        {/* Review summary */}
        {reviewSummary && (
          <div className="mb-3 pb-3 border-b border-[var(--glass-border)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">
                Overall
              </span>
              <span className="text-sm font-semibold text-[var(--pearl)]">
                {reviewSummary.overallScore.toFixed(1)}/10
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--ash)]">
              <span>{reviewSummary.totalIssues} issues</span>
              {reviewSummary.conflictsDetected > 0 && (
                <>
                  <span className="text-[var(--zinc)]">·</span>
                  <span className="text-[var(--amber)]">
                    {reviewSummary.conflictsDetected} conflicts
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Shadow comparison */}
        {onRunShadowReview && (
          <div className="mb-3 pb-3 border-b border-[var(--glass-border)]">
            <div className="mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">
                Rollout Mode
              </span>
              <div className="mt-1 flex gap-1">
                {(["baseline", "shadow", "active"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onSetRolloutMode?.(mode)}
                    className={`
                      px-2 py-1 text-[10px] uppercase tracking-[0.08em] border transition-colors
                      ${rolloutMode === mode
                        ? "bg-[var(--phosphor-glow)] border-[var(--phosphor)]/40 text-[var(--phosphor)]"
                        : "bg-[var(--graphite)] border-[var(--zinc)] text-[var(--ash)] hover:text-[var(--smoke)]"
                      }
                    `}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              {(rolloutMode === "active" || rolloutMode === "shadow") && (
                <button
                  onClick={() => onSetRolloutMode?.("baseline")}
                  className="mt-1 text-[10px] text-[var(--coral)] hover:underline"
                >
                  Roll back to baseline
                </button>
              )}
            </div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">
                Shadow Concordia
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={onRunShadowReview}
                disabled={shadowReview?.status === "running"}
              >
                {shadowReview?.status === "running" ? "Running..." : "Run Shadow Review"}
              </Button>
            </div>
            {!shadowReview || shadowReview.status === "idle" ? (
              <p className="text-[10px] text-[var(--ash)]">
                Compare baseline and candidate reviewer outputs silently.
              </p>
            ) : shadowReview.status === "error" ? (
              <p className="text-[10px] text-[var(--coral)]">
                Shadow run failed: {shadowReview.error || "unknown error"}
              </p>
            ) : (
              <div className="space-y-1.5 text-[10px] text-[var(--smoke)]">
                <div className="flex items-center justify-between">
                  <span>Decision agreement</span>
                  <span className="text-[var(--pearl)]">
                    {Math.round((shadowReview.decision_agreement_rate || 0) * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Precision proxy</span>
                  <span className="text-[var(--pearl)]">
                    {Math.round((shadowReview.precision_proxy || 0) * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Recall proxy</span>
                  <span className="text-[var(--pearl)]">
                    {Math.round((shadowReview.recall_proxy || 0) * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Avg score delta</span>
                  <span className="text-[var(--pearl)]">
                    {(shadowReview.mean_score_delta || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-3 border-t border-[var(--glass-border)] pt-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">
                  Rollout Timeline
                </span>
                <span className="text-[10px] text-[var(--ash)]">{rolloutHistory.length} events</span>
              </div>
              {latestAutoFallback && (
                <div className="mb-2 border border-[var(--coral)]/40 bg-[var(--coral)]/10 px-2 py-1 text-[10px] text-[var(--coral)]">
                  Auto fallback at {formatRolloutTime(latestAutoFallback.updated_at)}.
                </div>
              )}
              {rolloutEvents.length === 0 ? (
                <p className="text-[10px] text-[var(--ash)]">No rollout events recorded yet.</p>
              ) : (
                <div className="space-y-1">
                  {rolloutEvents.map((event) => (
                    <div
                      key={`${event.updated_at}-${event.mode}-${event.source}`}
                      className="border border-[var(--zinc)]/40 bg-[var(--graphite)] px-2 py-1 text-[10px]"
                    >
                      <div className="flex items-center justify-between text-[var(--pearl)]">
                        <span>{event.mode}</span>
                        <span className="text-[var(--ash)]">{formatRolloutTime(event.updated_at)}</span>
                      </div>
                      <div className="text-[var(--smoke)]">{rolloutSourceLabel(event.source)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onOpenRolloutHistory}>
                  View Full History
                </Button>
                {latestAutoFallback && rolloutMode !== "active" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onRecoverToActive}
                    disabled={isRecoveringToActive}
                  >
                    {isRecoveringToActive ? "Recovering..." : "Recover to Active"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reviewer cards */}
        {hasResults ? (
          <div className="space-y-3">
            {reviewResults.map((result) => (
              <ReviewerCard
                key={result.judgeId}
                result={result}
                isVisible={visibleJudgeIds.has(result.judgeId)}
                isRunning={runningJudgeId === result.judgeId}
                onToggleVisibility={() => onToggleJudgeVisibility?.(result.judgeId)}
                onRun={() => onRunSingleReview?.(result.judgeId)}
                onAnnotationClick={(id) => onAnnotationClick?.(id)}
                activeAnnotationId={activeAnnotationId ?? null}
              />
            ))}
          </div>
        ) : !isReviewing ? (
          <div className="text-center py-6">
            <div className="text-[var(--ash)] text-xs mb-1">No review yet</div>
            <div className="text-[10px] text-[var(--zinc)]">
              Write a draft and run a review
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="status-dot status-dot-working" />
              <span className="text-xs text-[var(--amber)]">Running reviewers...</span>
            </div>
            <div className="text-[10px] text-[var(--zinc)]">
              This may take a few seconds
            </div>
          </div>
        )}
      </Panel>

      {/* Skills */}
      <Panel
        className="border-0 flex-shrink-0"
        header={
          <PanelHeader
            title="Skills"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            }
          />
        }
      >
        <div className="space-y-2">
          {skills.map((skill, i) => (
            <button
              key={skill.name}
              className={`
                w-full flex items-center justify-between px-3 py-2
                bg-[var(--graphite)] border border-[var(--zinc)]
                hover:border-[var(--phosphor)]/30 hover:bg-[var(--phosphor-glow)]
                transition-all group
                animate-fade-in-up stagger-${i + 1}
              `}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{skill.icon}</span>
                <span className="text-xs text-[var(--silver)] group-hover:text-[var(--pearl)]">
                  {skill.name}
                </span>
              </div>
              <span className="text-[10px] font-mono text-[var(--ash)] opacity-0 group-hover:opacity-100 transition-opacity">
                {skill.shortcut}
              </span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
