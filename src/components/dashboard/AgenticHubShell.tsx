"use client";

import { useMemo, useState } from "react";
import type {
  Doer,
  HubEvent,
  LlmTelemetryEvent,
  Reviewer,
  ReviewSummaryFE,
  RolloutHistoryEvent,
  ShadowReviewSnapshot,
} from "@/lib/store";
import { CrewIdentityCard } from "@/components/crew/CrewIdentityCard";
import { CrewIdentityEditorModal } from "@/components/crew/CrewIdentityEditorModal";

type SyncState = "idle" | "syncing" | "done";

interface AgenticHubShellProps {
  projectName?: string;
  goal?: string | null;
  syncStatus: SyncState;
  reviewersCount: number;
  doers?: Doer[];
  reviewers?: Reviewer[];
  activeCrewVersionId?: string;
  crewVersions?: Array<{
    version_id: string;
    created_at: string;
    source?: string;
    reason?: string | null;
  }>;
  crewVersionsLoading?: boolean;
  isRollingBackCrewVersion?: boolean;
  isReviewing: boolean;
  reviewSummary: ReviewSummaryFE | null;
  llmTelemetry: LlmTelemetryEvent[];
  hubEvents?: HubEvent[];
  shadowReview?: ShadowReviewSnapshot;
  rolloutHistory?: RolloutHistoryEvent[];
  isSavingCrewMember?: boolean;
  onRefreshCrewVersions?: () => void;
  onRollbackCrewVersion?: (versionId: string) => void;
  onSaveCrewMember?: (payload: {
    kind: "doer" | "reviewer";
    previousId: string;
    member: Doer | Reviewer;
  }) => void | Promise<void>;
}

type StatusTone = "ready" | "working" | "idle";

function statusStyle(tone: StatusTone): string {
  if (tone === "ready") return "bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--border-light)]";
  if (tone === "working") return "bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--border-light)]";
  return "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-light)]";
}

function statusLabel(tone: StatusTone): string {
  if (tone === "ready") return "Ready";
  if (tone === "working") return "In Progress";
  return "Waiting";
}

function formatRolloutTime(value?: string): string {
  if (!value) return "unknown";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgenticHubShell({
  projectName,
  goal,
  syncStatus,
  reviewersCount,
  doers = [],
  reviewers = [],
  activeCrewVersionId,
  crewVersions = [],
  crewVersionsLoading = false,
  isRollingBackCrewVersion = false,
  isReviewing,
  reviewSummary,
  llmTelemetry,
  hubEvents = [],
  shadowReview,
  rolloutHistory = [],
  isSavingCrewMember = false,
  onRefreshCrewVersions,
  onRollbackCrewVersion,
  onSaveCrewMember,
}: AgenticHubShellProps) {
  const ingestTone: StatusTone =
    syncStatus === "done" ? "ready" : syncStatus === "syncing" ? "working" : "idle";
  const reviewersTone: StatusTone = reviewersCount > 0 ? "ready" : "idle";
  const reviewTone: StatusTone = isReviewing ? "working" : reviewSummary ? "ready" : "idle";

  const phaseCards = [
    {
      id: "ingestion",
      title: "Data Ingestion",
      description: syncStatus === "done" ? "Source files synced to this project." : "Folder sync not finished yet.",
      tone: ingestTone,
      meta: syncStatus === "syncing" ? "Syncing now" : syncStatus === "done" ? "Synced" : "Not started",
    },
    {
      id: "reviewers",
      title: "Reviewer Setup (Critics)",
      description:
        reviewersCount > 0
          ? `${reviewersCount} reviewer${reviewersCount === 1 ? "" : "s"} configured.`
          : "No reviewers configured yet.",
      tone: reviewersTone,
      meta: reviewersCount > 0 ? "Configured" : "Pending",
    },
    {
      id: "review",
      title: "Review Cycle",
      description:
        reviewSummary != null
          ? `${reviewSummary.totalIssues} open issue${reviewSummary.totalIssues === 1 ? "" : "s"} in latest run.`
          : "Run a review to generate quality signals.",
      tone: reviewTone,
      meta: isReviewing ? "Running" : reviewSummary ? `${reviewSummary.overallScore.toFixed(1)}/10` : "No run yet",
    },
  ];
  const latestRolloutEvent =
    rolloutHistory.length > 0 ? rolloutHistory[rolloutHistory.length - 1] : null;
  const latestAutoFallback = [...rolloutHistory]
    .reverse()
    .find((event) => event.source === "auto_fallback");
  const [editingState, setEditingState] = useState<{
    kind: "doer" | "reviewer";
    previousId: string;
    member: Doer | Reviewer;
  } | null>(null);
  const identityCount = doers.length + reviewers.length;
  const editingMember = useMemo(() => editingState?.member ?? null, [editingState]);
  const shellClass =
    "glass-panel rounded-2xl px-5 py-4";
  const blockClass =
    "mt-3 rounded-xl border border-[var(--deck-edge)] bg-[var(--deck-frost)] px-4 py-3 shadow-[var(--shadow-sm)] backdrop-blur-sm";
  const itemClass =
    "rounded-lg border border-[var(--deck-edge)] bg-[var(--deck-frost-strong)] px-3 py-2 shadow-[var(--shadow-sm)]";

  const handleSaveIdentity = async (updated: Doer | Reviewer) => {
    if (!editingState || !onSaveCrewMember) return;
    await onSaveCrewMember({
      kind: editingState.kind,
      previousId: editingState.previousId,
      member: updated,
    });
    setEditingState(null);
  };

  return (
    <section className={shellClass}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Agentic Hub</div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{projectName || "Current Project"}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{goal || "Set a goal to align agent and reviewer behavior."}</p>
        </div>
        <div className="rounded-full border border-[var(--deck-edge)] bg-[var(--deck-frost-strong)] px-3 py-1 text-xs text-[var(--text-secondary)]">
          Interactive control surface
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {phaseCards.map((card) => (
          <article key={card.id} className="rounded-xl border border-[var(--deck-edge)] bg-[var(--deck-frost-strong)] px-4 py-3 shadow-[var(--shadow-sm)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{card.title}</h3>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyle(card.tone)}`}
              >
                {statusLabel(card.tone)}
              </span>
            </div>
            <p className="mb-2 text-xs leading-5 text-[var(--text-secondary)]">{card.description}</p>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{card.meta}</p>
          </article>
        ))}
      </div>

      <div className={blockClass}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Crew Identities</h3>
          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            {identityCount} active cards
          </span>
        </div>
        {identityCount === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">No doers/reviewers configured for this project yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {doers.map((doer) => (
              <CrewIdentityCard
                key={`hub-doer-${doer.id}`}
                kind="doer"
                member={doer}
                showToggle={false}
                onEdit={
                  onSaveCrewMember
                    ? () =>
                        setEditingState({
                          kind: "doer",
                          previousId: doer.id,
                          member: doer,
                        })
                    : undefined
                }
              />
            ))}
            {reviewers.map((reviewer) => (
              <CrewIdentityCard
                key={`hub-reviewer-${reviewer.id}`}
                kind="reviewer"
                member={reviewer}
                showToggle={false}
                onEdit={
                  onSaveCrewMember
                    ? () =>
                        setEditingState({
                          kind: "reviewer",
                          previousId: reviewer.id,
                          member: reviewer,
                        })
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className={blockClass}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Rollout Safety</h3>
          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Phase 4</span>
        </div>
        {latestRolloutEvent ? (
          <p className="text-xs text-[var(--text-secondary)]">
            Current mode: <span className="font-semibold text-[var(--text-primary)]">{latestRolloutEvent.mode}</span> since{" "}
            {formatRolloutTime(latestRolloutEvent.updated_at)}.
          </p>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">No rollout events yet.</p>
        )}
        {latestAutoFallback && (
          <div className="mt-2 rounded-md border border-[var(--border-light)] bg-[var(--status-error-bg)] px-3 py-2 text-xs text-[var(--status-error)]">
            Auto-fallback occurred at {formatRolloutTime(latestAutoFallback.updated_at)}.
          </div>
        )}
      </div>

      <div className={blockClass}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Model Routing Activity</h3>
          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Lane C</span>
        </div>
        {llmTelemetry.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">
            No model-route events yet. Generate reviewers or run LLM-backed actions to populate.
          </p>
        ) : (
          <div className="space-y-2">
            {llmTelemetry.slice(0, 3).map((event) => (
              <article
                key={event.id}
                className={itemClass}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-medium text-[var(--text-primary)]">
                    {event.task.replaceAll("_", " ")}
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      event.fallback_used
                        ? "border-[var(--border-light)] bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
                        : "border-[var(--border-light)] bg-[var(--status-success-bg)] text-[var(--status-success)]"
                    }`}
                  >
                    {event.fallback_used ? "Fallback Used" : "Primary Model"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  Winner: {(event.winner_provider || "unknown") + " / " + (event.winner_model || "unknown")}
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Attempts: {event.attempts.length}{" "}
                  {event.attempts.length > 0
                    ? `(${event.attempts.map((a) => `${a.provider}:${a.success ? "ok" : "err"}`).join(", ")})`
                    : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className={blockClass}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Crew Versions</h3>
          <div className="flex items-center gap-2">
            {activeCrewVersionId && (
              <span className="rounded-full border border-[var(--border-light)] bg-[var(--bg-primary)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                Active: {activeCrewVersionId}
              </span>
            )}
            {onRefreshCrewVersions && (
              <button
                type="button"
                onClick={onRefreshCrewVersions}
                disabled={crewVersionsLoading || isRollingBackCrewVersion}
                className="rounded border border-[var(--border-medium)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
              >
                Refresh
              </button>
            )}
          </div>
        </div>
        {crewVersionsLoading ? (
          <p className="text-xs text-[var(--status-warning)]">Loading crew versions...</p>
        ) : crewVersions.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">No crew versions yet.</p>
        ) : (
          <div className="space-y-2">
            {crewVersions.slice(0, 4).map((version) => {
              const isActive = version.version_id === activeCrewVersionId;
              return (
                <article
                  key={version.version_id}
                  className={itemClass}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-medium text-[var(--text-primary)]">{version.version_id}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                        {version.source || "manual"}
                      </span>
                      {isActive ? (
                        <span className="rounded-full border border-[var(--border-light)] bg-[var(--status-success-bg)] px-2 py-0.5 text-[10px] text-[var(--status-success)]">
                          Active
                        </span>
                      ) : (
                        onRollbackCrewVersion && (
                          <button
                            type="button"
                            onClick={() => onRollbackCrewVersion(version.version_id)}
                            disabled={isRollingBackCrewVersion}
                            className="rounded border border-[var(--border-medium)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
                          >
                            Rollback
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {formatRolloutTime(version.created_at)}
                    {version.reason ? ` - ${version.reason}` : ""}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className={blockClass}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Agent Pings</h3>
          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Live</span>
        </div>
        {hubEvents.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">No recent agent updates.</p>
        ) : (
          <div className="space-y-2">
            {hubEvents.slice(0, 5).map((event) => (
              <article key={event.id} className={itemClass}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-[var(--text-primary)]">
                    {event.actor_name} ({event.actor_type})
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    {formatRolloutTime(event.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{event.message}</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">{event.project_name}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className={blockClass}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Shadow Concordia</h3>
          <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Phase 1</span>
        </div>
        {!shadowReview || shadowReview.status === "idle" ? (
          <p className="text-xs text-[var(--text-secondary)]">No shadow run yet.</p>
        ) : shadowReview.status === "running" ? (
          <p className="text-xs text-[var(--status-warning)]">Shadow run in progress.</p>
        ) : shadowReview.status === "error" ? (
          <p className="text-xs text-[var(--status-error)]">
            Failed: {shadowReview.error || "unknown error"}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">
            Agreement {Math.round((shadowReview.decision_agreement_rate || 0) * 100)}%, precision{" "}
            {Math.round((shadowReview.precision_proxy || 0) * 100)}%, recall{" "}
            {Math.round((shadowReview.recall_proxy || 0) * 100)}%.
          </p>
        )}
      </div>

      <CrewIdentityEditorModal
        isOpen={Boolean(editingState)}
        kind={editingState?.kind || "doer"}
        member={editingMember}
        isSaving={isSavingCrewMember}
        onClose={() => setEditingState(null)}
        onSave={handleSaveIdentity}
      />
    </section>
  );
}
