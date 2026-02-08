import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RightPanel } from "./RightPanel";
import type { RolloutHistoryEvent } from "@/lib/store";

const historyWithFallback: RolloutHistoryEvent[] = [
  {
    mode: "active",
    from_mode: "shadow",
    updated_at: "2026-02-07T09:00:00Z",
    reason: "manual promote",
    source: "manual",
  },
  {
    mode: "shadow",
    from_mode: "active",
    updated_at: "2026-02-07T10:00:00Z",
    reason: "auto fallback",
    source: "auto_fallback",
    trigger: "candidate failure",
  },
];

describe("RightPanel rollout controls", () => {
  it("opens history and triggers recover action after fallback", () => {
    const onOpenRolloutHistory = vi.fn();
    const onRecoverToActive = vi.fn();

    render(
      <RightPanel
        syncStatus="done"
        connector="local"
        onRunShadowReview={() => {}}
        rolloutMode="shadow"
        rolloutHistory={historyWithFallback}
        onOpenRolloutHistory={onOpenRolloutHistory}
        onRecoverToActive={onRecoverToActive}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /view full history/i }));
    expect(onOpenRolloutHistory).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /recover to active/i }));
    expect(onRecoverToActive).toHaveBeenCalledTimes(1);
  });

  it("hides recover action when mode is already active", () => {
    render(
      <RightPanel
        syncStatus="done"
        connector="local"
        onRunShadowReview={() => {}}
        rolloutMode="active"
        rolloutHistory={historyWithFallback}
        onOpenRolloutHistory={() => {}}
        onRecoverToActive={() => {}}
      />
    );

    expect(screen.queryByRole("button", { name: /recover to active/i })).not.toBeInTheDocument();
  });

  it("hides recover action when no fallback event exists", () => {
    render(
      <RightPanel
        syncStatus="done"
        connector="local"
        onRunShadowReview={() => {}}
        rolloutMode="shadow"
        rolloutHistory={[
          {
            mode: "shadow",
            from_mode: "baseline",
            updated_at: "2026-02-07T08:00:00Z",
            reason: "manual set",
            source: "manual",
          },
        ]}
        onOpenRolloutHistory={() => {}}
        onRecoverToActive={() => {}}
      />
    );

    expect(screen.queryByRole("button", { name: /recover to active/i })).not.toBeInTheDocument();
  });

  it("exposes run and hide/show controls on compact reviewer rows", () => {
    const onRunSingleReview = vi.fn();
    const onToggleJudgeVisibility = vi.fn();

    render(
      <RightPanel
        syncStatus="done"
        connector="local"
        crewReviewers={[
          {
            id: "legal_guard",
            name: "Vera, the Legal Guard",
            reason: "Checks legal and compliance risk",
            enabled: true,
          },
        ]}
        reviewResults={[
          {
            judgeId: "legal_guard",
            judgeName: "Vera, the Legal Guard",
            score: 8.2,
            decision: "pass_with_warnings",
            reasoning: "Needs stronger disclaimers in section 3.",
            annotations: [],
            filesReferenced: [],
            color: { id: "blue", underline: "#2563eb", bg: "rgba(37,99,235,.08)", label: "Blue" },
          },
        ]}
        visibleJudgeIds={new Set(["legal_guard"])}
        onRunSingleReview={onRunSingleReview}
        onToggleJudgeVisibility={onToggleJudgeVisibility}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /run vera, the legal guard review/i }));
    expect(onRunSingleReview).toHaveBeenCalledWith("legal_guard");

    fireEvent.click(screen.getAllByRole("button", { name: /hide vera, the legal guard highlights/i })[0]);
    expect(onToggleJudgeVisibility).toHaveBeenCalledWith("legal_guard");
  });

  it("renders ops rails with escalation, capacity, and latest decisions", () => {
    render(
      <RightPanel
        syncStatus="done"
        connector="local"
        escalation={{
          level: "L2",
          trigger: "auto_fallback",
          reason: "Candidate reviewer path failed quality threshold.",
          recommended_action: "Stay on baseline and inspect conflict notes.",
          status: "open",
          created_at: "2026-02-08T08:00:00Z",
        }}
        capacity={{
          maxConcurrentDoers: 3,
          maxReviewerRunsPerDraft: 5,
          reviewerRunsCurrentDraft: 4,
          queueDepth: 1,
        }}
        decisionLog={[
          {
            id: "dlog-1",
            timestamp: "2026-02-08T08:10:00Z",
            project_id: "proj-1",
            actor_type: "system",
            actor_id: "rollout_guard",
            decision_type: "fallback",
            reason: "automatic fallback",
            impact_summary: "Moved to shadow mode",
          },
        ]}
      />
    );

    expect(screen.getByText(/ops rails/i)).toBeInTheDocument();
    expect(screen.getByText(/l2 open/i)).toBeInTheDocument();
    expect(screen.getByText(/reviewer budget/i)).toBeInTheDocument();
    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(screen.getByText(/latest decisions/i)).toBeInTheDocument();
    expect(screen.getByText(/automatic fallback/i)).toBeInTheDocument();
  });
});
