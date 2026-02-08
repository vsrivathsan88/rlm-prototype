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

    fireEvent.click(screen.getByRole("button", { name: /hide vera, the legal guard highlights/i }));
    expect(onToggleJudgeVisibility).toHaveBeenCalledWith("legal_guard");
  });
});
