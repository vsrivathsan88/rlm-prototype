import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RightPanel } from "./RightPanel";
import type { CommentThread } from "@/lib/store";

describe("RightPanel behavior", () => {
  it("hides legacy shadow rollout controls", () => {
    render(
      <RightPanel
        syncStatus="done"
        connector="local"
      />
    );

    expect(screen.queryByText(/shadow concordia/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run shadow review/i })).not.toBeInTheDocument();
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

  it("shows thread controls and routes actions", () => {
    const onSelectThread = vi.fn();
    const onAcceptThreadSuggestion = vi.fn();
    const onRejectThreadSuggestion = vi.fn();
    const onResolveThread = vi.fn();

    const threads: CommentThread[] = [
      {
        id: "thread-1",
        key: "p1:legal_guard:legal_guard-0",
        project_id: "p1",
        annotation_id: "legal_guard-0",
        judge_id: "legal_guard",
        judge_name: "Vera, the Legal Guard",
        severity: "warning",
        status: "open",
        anchor: { startPos: 1, endPos: 20, startLine: 2, endLine: 2 },
        color: { id: "blue", underline: "#2563eb", bg: "rgba(37,99,235,.08)", label: "Blue" },
        messages: [
          {
            id: "m-1",
            author_type: "reviewer",
            author_name: "Vera, the Legal Guard",
            body: "Replace this sentence with \"Clear legal disclaimer.\"",
            created_at: "2026-02-08T09:30:00Z",
          },
        ],
        suggestion: {
          id: "s-1",
          kind: "replace_range",
          status: "pending",
          from: 1,
          to: 20,
          original_text: "Old text",
          replacement_text: "Clear legal disclaimer.",
        },
        created_at: "2026-02-08T09:30:00Z",
        updated_at: "2026-02-08T09:30:00Z",
      },
    ];

    render(
      <RightPanel
        syncStatus="done"
        connector="local"
        commentThreads={threads}
        activeThreadId="thread-1"
        onSelectThread={onSelectThread}
        onAcceptThreadSuggestion={onAcceptThreadSuggestion}
        onRejectThreadSuggestion={onRejectThreadSuggestion}
        onResolveThread={onResolveThread}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /vera, the legal guard/i }));
    expect(onSelectThread).toHaveBeenCalledWith("thread-1");

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onAcceptThreadSuggestion).toHaveBeenCalledWith("thread-1");

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onRejectThreadSuggestion).toHaveBeenCalledWith("thread-1");

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    expect(onResolveThread).toHaveBeenCalledWith("thread-1");
  });

  it("shows last run trace with docs read and citations", () => {
    render(
      <RightPanel
        syncStatus="done"
        connector="local"
        lastCommandTrace={{
          created_at: "2026-02-08T11:45:00Z",
          model: "qwen/qwen3-32b",
          provider: "groq",
          answer_preview: "Draft complete with prioritized action items.",
          reasoning: "Reasoned about launch clarity and execution risk.",
          reasoning_summary: "Used launch brief and FAQ evidence.",
          context_files: ["brief.md", "faq.docx"],
          context_file_count: 2,
          context_file_summaries: [
            { filename: "brief.md", chars: 320, preview: "Launch timeline and risks" },
            { filename: "faq.docx", chars: 210, preview: "Pricing answers and objections" },
          ],
          citations: [
            {
              filename: "brief.md",
              quote: "Launch starts on March 14",
              why: "Supports timing claim",
              line_start: 12,
              line_end: 12,
            },
          ],
          evidence_gaps: ["No source confirms budget assumptions."],
        }}
      />
    );

    expect(screen.getByText(/last run/i)).toBeInTheDocument();
    expect(screen.getByText(/docs read: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/citations: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/launch starts on march 14/i)).toBeInTheDocument();
    expect(screen.getByText(/gap: no source confirms budget assumptions\./i)).toBeInTheDocument();
  });
});
