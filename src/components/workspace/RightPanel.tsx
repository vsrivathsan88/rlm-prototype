"use client";

import { useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import type {
  CommandRunTrace,
  CapacityState,
  CommentThread,
  DecisionLogEvent,
  Doer,
  EscalationState,
  Reviewer,
  ReviewResultFE,
  ReviewSummaryFE,
} from "@/lib/store";

interface RightPanelProps {
  syncStatus: "idle" | "syncing" | "done";
  connector: string | null;
  filesCount?: number;
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
  decisionLog?: DecisionLogEvent[];
  escalation?: EscalationState | null;
  capacity?: CapacityState | null;
  lastCommandTrace?: CommandRunTrace | null;
  commentThreads?: CommentThread[];
  activeThreadId?: string | null;
  onSelectThread?: (threadId: string) => void;
  onAcceptThreadSuggestion?: (threadId: string) => void;
  onRejectThreadSuggestion?: (threadId: string) => void;
  onRevertThreadSuggestion?: (threadId: string) => void;
  onResolveThread?: (threadId: string) => void;
  crewDoers?: Doer[];
  crewReviewers?: Reviewer[];
}

function formatTime(value?: string): string {
  if (!value) return "unknown";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deterministicEmoji(seed: string, pool: string[]): string {
  if (!pool.length) return "AI";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

function memberEmoji(id: string, name: string, kind: "doer" | "reviewer"): string {
  if (kind === "doer") {
    return deterministicEmoji(`${id}:${name}`, ["🧭", "🛠️", "🚀", "🧠", "📐", "⚙️"]);
  }
  return deterministicEmoji(`${id}:${name}`, ["🔍", "🧪", "🛡️", "📏", "🧾", "🧠"]);
}

function memberSubtitle(
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
  lastCommandTrace = null,
  commentThreads = [],
  activeThreadId = null,
  onSelectThread,
  onAcceptThreadSuggestion,
  onRejectThreadSuggestion,
  onRevertThreadSuggestion,
  onResolveThread,
  crewDoers = [],
  crewReviewers = [],
}: RightPanelProps) {
  const enabledDoers = crewDoers.filter((member) => member.enabled);
  const enabledReviewers = crewReviewers.filter((member) => member.enabled);
  const hasResults = reviewResults.length > 0;
  const reviewerResultById = new Map(reviewResults.map((result) => [result.judgeId, result]));
  const openThreads = commentThreads.filter((thread) => thread.status === "open");
  const [expandedReviewerNotesId, setExpandedReviewerNotesId] = useState<string | null>(null);

  return (
    <div className="w-72 flex-shrink-0 border-l border-[var(--glass-border)] bg-[var(--carbon)]/50 flex flex-col overflow-hidden">
      <Panel
        className="border-0 border-b border-[var(--glass-border)] max-h-[45vh] overflow-auto"
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
        {enabledDoers.length === 0 && enabledReviewers.length === 0 ? (
          <p className="text-[10px] text-[var(--ash)]">No crew assigned yet.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">
                Reviewers
              </div>
              <div className="space-y-1.5">
                {enabledReviewers.length === 0 ? (
                  <p className="text-[10px] text-[var(--ash)]">No active reviewers.</p>
                ) : (
                  enabledReviewers.map((reviewer) => {
                    const reviewerResult = reviewerResultById.get(reviewer.id);
                    const noteCount = reviewerResult?.annotations.length || 0;
                    return (
                      <div
                        key={reviewer.id}
                        className="rounded-md border border-[var(--zinc)]/40 bg-[var(--graphite)] px-2 py-1.5"
                      >
                        <div className="flex items-start gap-2">
                          <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[var(--zinc)]/70 bg-[var(--carbon)] text-sm">
                            {memberEmoji(reviewer.id, reviewer.name, "reviewer")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs text-[var(--pearl)]">{reviewer.name}</div>
                            <div className="truncate text-[10px] text-[var(--ash)]">
                              {memberSubtitle(reviewer, "reviewer")}
                            </div>
                          </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onRunSingleReview?.(reviewer.id)}
                            disabled={runningJudgeId === reviewer.id}
                            className="rounded border border-[var(--zinc)]/80 bg-[var(--carbon)] px-1.5 py-0.5 text-[10px] text-[var(--smoke)] hover:border-[var(--phosphor)]/40 hover:text-[var(--phosphor)] disabled:opacity-60"
                            aria-label={`Run ${reviewer.name} review`}
                          >
                            {runningJudgeId === reviewer.id ? "Running..." : "Run"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleJudgeVisibility?.(reviewer.id)}
                            className="rounded border border-[var(--zinc)]/80 bg-[var(--carbon)] px-1.5 py-0.5 text-[10px] text-[var(--smoke)] hover:border-[var(--phosphor)]/40 hover:text-[var(--phosphor)]"
                            aria-label={`${visibleJudgeIds.has(reviewer.id) ? "Hide" : "Show"} ${reviewer.name} highlights`}
                          >
                            {visibleJudgeIds.has(reviewer.id) ? "Hide" : "Show"}
                          </button>
                          {reviewerResult && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedReviewerNotesId((current) =>
                                  current === reviewer.id ? null : reviewer.id
                                )
                              }
                              className="rounded border border-[var(--zinc)]/80 bg-[var(--carbon)] px-1.5 py-0.5 text-[10px] text-[var(--smoke)] hover:border-[var(--phosphor)]/40 hover:text-[var(--phosphor)]"
                              aria-label={`View ${reviewer.name} critique`}
                            >
                              Notes ({noteCount})
                            </button>
                          )}
                        </div>
                        {expandedReviewerNotesId === reviewer.id && reviewerResult && (
                          <div className="mt-1.5 rounded border border-[var(--zinc)]/40 bg-[var(--carbon)] px-2 py-1.5">
                            {reviewerResult.annotations.length > 0 ? (
                              <div className="space-y-1">
                                {reviewerResult.annotations.slice(0, 4).map((annotation) => (
                                  <button
                                    key={annotation.id}
                                    type="button"
                                    onClick={() => onAnnotationClick?.(annotation.id)}
                                    className={`w-full text-left text-[10px] ${
                                      annotation.id === activeAnnotationId
                                        ? "text-[var(--pearl)]"
                                        : "text-[var(--smoke)] hover:text-[var(--pearl)]"
                                    }`}
                                  >
                                    L{annotation.startLine}: {annotation.message}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-[var(--ash)]">No issues in latest run.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">
                Doers
              </div>
              <div className="space-y-1.5">
                {enabledDoers.length === 0 ? (
                  <p className="text-[10px] text-[var(--ash)]">No active doers.</p>
                ) : (
                  enabledDoers.map((doer) => (
                    <div
                      key={doer.id}
                      className="rounded-md border border-[var(--zinc)]/40 bg-[var(--graphite)] px-2 py-1.5"
                    >
                      <div className="flex items-start gap-2">
                        <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[var(--zinc)]/70 bg-[var(--carbon)] text-sm">
                          {memberEmoji(doer.id, doer.name, "doer")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs text-[var(--pearl)]">{doer.name}</div>
                          <div className="truncate text-[10px] text-[var(--ash)]">
                            {memberSubtitle(doer, "doer")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        className="border-0 border-b border-[var(--glass-border)] max-h-[35vh] overflow-auto"
        header={
          <PanelHeader
            title="Review"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4" />
                <path d="M21 12c0 5-4 9-9 9s-9-4-9-9 4-9 9-9 9 4 9 9z" />
              </svg>
            }
            action={
              hasResults ? (
                <Button variant="ghost" size="sm" onClick={onClearReview}>
                  Clear
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={onRunReview} disabled={isReviewing}>
                  {isReviewing ? "Reviewing..." : "Run Review"}
                </Button>
              )
            }
          />
        }
      >
        {reviewSummary && (
          <p className="mb-2 text-[10px] text-[var(--smoke)]">
            Score {reviewSummary.overallScore.toFixed(1)}/10, {reviewSummary.totalIssues} issues.
          </p>
        )}

        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">Threads</span>
          <span className="text-[10px] text-[var(--ash)]">{openThreads.length} open</span>
        </div>
        {openThreads.length === 0 ? (
          <p className="text-[10px] text-[var(--ash)]">No active reviewer threads.</p>
        ) : (
          <div className="space-y-1.5">
            {openThreads.slice(0, 8).map((thread) => (
              <div
                key={thread.id}
                className={`rounded border px-2 py-1.5 ${
                  activeThreadId === thread.id
                    ? "border-[var(--phosphor)]/40 bg-[var(--phosphor-glow)]"
                    : "border-[var(--zinc)]/40 bg-[var(--graphite)]"
                }`}
              >
                <button type="button" onClick={() => onSelectThread?.(thread.id)} className="w-full text-left">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[11px] text-[var(--pearl)]">{thread.judge_name || "Reviewer"}</span>
                    <span className="text-[10px] text-[var(--ash)]">L{thread.anchor.startLine}</span>
                  </div>
                  <div className="truncate text-[10px] text-[var(--smoke)]">{thread.messages[0]?.body || "Comment"}</div>
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {thread.suggestion?.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => onAcceptThreadSuggestion?.(thread.id)}
                        className="rounded border border-[var(--zinc)] px-1.5 py-0.5 text-[10px] text-[var(--smoke)] hover:text-[var(--pearl)]"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectThreadSuggestion?.(thread.id)}
                        className="rounded border border-[var(--zinc)] px-1.5 py-0.5 text-[10px] text-[var(--smoke)] hover:text-[var(--pearl)]"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {thread.suggestion?.status === "accepted" && (
                    <button
                      type="button"
                      onClick={() => onRevertThreadSuggestion?.(thread.id)}
                      className="rounded border border-[var(--zinc)] px-1.5 py-0.5 text-[10px] text-[var(--smoke)] hover:text-[var(--pearl)]"
                    >
                      Revert
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onResolveThread?.(thread.id)}
                    className="rounded border border-[var(--zinc)] px-1.5 py-0.5 text-[10px] text-[var(--smoke)] hover:text-[var(--pearl)]"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {lastCommandTrace && (
        <Panel
          className="border-0 flex-1 overflow-auto"
          header={
            <PanelHeader
              title="Last Run"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              }
            />
          }
        >
          <p className="text-[10px] text-[var(--ash)]">{formatTime(lastCommandTrace.created_at)}</p>
          {lastCommandTrace.trace_id ? (
            <p className="mt-1 text-[10px] text-[var(--ash)]">Trace: {lastCommandTrace.trace_id}</p>
          ) : null}
          <p className="mt-1 text-[10px] text-[var(--smoke)]">{lastCommandTrace.answer_preview || "No preview."}</p>
          <div className="mt-2 rounded border border-[var(--zinc)]/50 bg-[var(--graphite)] px-2 py-1.5">
            <p className="text-[10px] text-[var(--smoke)]">
              Docs read: {lastCommandTrace.context_file_count}
            </p>
            {lastCommandTrace.context_file_summaries && lastCommandTrace.context_file_summaries.length > 0 ? (
              <div className="mt-1 space-y-1">
                {lastCommandTrace.context_file_summaries.slice(0, 6).map((item) => (
                  <div key={item.filename} className="text-[10px] text-[var(--ash)]">
                    <span className="text-[var(--smoke)]">{item.filename}</span>
                    {item.preview ? ` - ${item.preview}` : ""}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[10px] text-[var(--ash)]">No file context was attached.</p>
            )}
          </div>

          <div className="mt-2 rounded border border-[var(--zinc)]/50 bg-[var(--graphite)] px-2 py-1.5">
            <p className="text-[10px] text-[var(--smoke)]">
              Tool calls: {lastCommandTrace.tool_calls?.length ?? 0}
            </p>
            {lastCommandTrace.tool_calls && lastCommandTrace.tool_calls.length > 0 ? (
              <div className="mt-1 space-y-1">
                {lastCommandTrace.tool_calls.slice(0, 10).map((call, idx) => (
                  <div key={`${call.tool_name}-${idx}`} className="text-[10px] text-[var(--ash)]">
                    {call.tool_name} [{call.source}]
                    {call.file ? ` ${call.file}` : ""}
                    {typeof call.bytes_read === "number" ? ` (${call.bytes_read})` : ""}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[10px] text-[var(--ash)]">No tool activity recorded.</p>
            )}
          </div>

          <div className="mt-2 rounded border border-[var(--zinc)]/50 bg-[var(--graphite)] px-2 py-1.5">
            <p className="text-[10px] text-[var(--smoke)]">
              Citations: {lastCommandTrace.citations?.length ?? 0}
            </p>
            {lastCommandTrace.citations && lastCommandTrace.citations.length > 0 ? (
              <div className="mt-1 space-y-1.5">
                {lastCommandTrace.citations.slice(0, 8).map((citation, idx) => (
                  <div key={`${citation.filename}-${idx}`} className="rounded border border-[var(--zinc)]/40 px-1.5 py-1">
                    <div className="text-[10px] text-[var(--pearl)]">
                      {citation.filename}
                      {citation.line_start ? ` (L${citation.line_start}${citation.line_end && citation.line_end !== citation.line_start ? `-${citation.line_end}` : ""})` : ""}
                    </div>
                    <div className="text-[10px] text-[var(--smoke)]">&quot;{citation.quote}&quot;</div>
                    {citation.why ? <div className="text-[10px] text-[var(--ash)]">{citation.why}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[10px] text-[var(--ash)]">No citation evidence returned.</p>
            )}
            {lastCommandTrace.evidence_gaps && lastCommandTrace.evidence_gaps.length > 0 ? (
              <div className="mt-1 space-y-1">
                {lastCommandTrace.evidence_gaps.slice(0, 4).map((gap, idx) => (
                  <div key={`gap-${idx}`} className="text-[10px] text-[var(--amber)]">
                    Gap: {gap}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {(lastCommandTrace.reasoning_summary || lastCommandTrace.reasoning) && (
            <details className="mt-2 rounded border border-[var(--zinc)]/50 bg-[var(--graphite)] px-2 py-1.5">
              <summary className="cursor-pointer text-[10px] text-[var(--smoke)]">Rationale</summary>
              <p className="mt-1 whitespace-pre-wrap text-[10px] text-[var(--smoke)]">
                {lastCommandTrace.reasoning_summary || lastCommandTrace.reasoning}
              </p>
            </details>
          )}
        </Panel>
      )}
    </div>
  );
}
