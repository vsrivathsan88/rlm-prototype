/**
 * Orchestrates the review flow:
 * 1. Extract text from TipTap editor
 * 2. Call the backend review API
 * 3. Map line-based annotations to ProseMirror positions
 * 4. Assign reviewer colors
 * 5. Return transformed results ready for the store
 */

import type { Editor } from "@tiptap/react";
import { reviewDocument } from "@/lib/api";
import { buildLineMap, linesToPositions } from "@/lib/line-position-map";
import { buildColorMap } from "@/lib/reviewer-colors";
import type {
  ReviewResultFE,
  ReviewAnnotation,
  ReviewSummaryFE,
} from "@/lib/store";
import type { BackendConflict, BackendLlmRouteEvent } from "@/lib/api";
import type { Reviewer } from "@/lib/store";

type ProfileContext = {
  job_function?: string;
  team_size?: string;
  reporting_level?: string;
  industry?: string;
  company_stage?: string;
  current_work?: Record<string, unknown>;
};

export async function runReview(
  editor: Editor,
  judgeIds: string[],
  projectId?: string,
  options?: {
    profileContext?: ProfileContext;
    reviewerContext?: Reviewer[];
  }
): Promise<{
  results: ReviewResultFE[];
  summary: ReviewSummaryFE;
  conflicts: BackendConflict[];
  llmMeta: BackendLlmRouteEvent[];
}> {
  const documentText = editor.getText({ blockSeparator: "\n" });

  if (!documentText.trim()) {
    throw new Error("Document is empty. Write something before running a review.");
  }

  const response = await reviewDocument({
    document_text: documentText,
    judge_ids: judgeIds,
    project_id: projectId,
    profile_context: options?.profileContext,
    reviewer_context: options?.reviewerContext?.map((reviewer) => ({
      id: reviewer.id,
      name: reviewer.name,
      description: reviewer.description ?? reviewer.reason,
      system_prompt: reviewer.system_prompt,
      strictness: reviewer.strictness,
      rubric: reviewer.rubric,
    })),
  });

  // Build line → position map from the current document
  const lineMap = buildLineMap(editor.state.doc);
  const colorMap = buildColorMap(response.results.map((r) => r.judge_id));

  const results: ReviewResultFE[] = response.results.map((backendResult) => {
    const color = colorMap.get(backendResult.judge_id)!;

    const annotations: ReviewAnnotation[] = backendResult.annotations.map(
      (ann, idx) => {
        const positions = linesToPositions(lineMap, ann.start, ann.end);

        return {
          id: `${backendResult.judge_id}-${idx}`,
          judgeId: backendResult.judge_id,
          startLine: ann.start,
          endLine: ann.end,
          startPos: positions?.from,
          endPos: positions?.to,
          message: ann.message,
          severity: ann.severity as "info" | "warning" | "critical",
          criterion: ann.criterion,
        };
      }
    );

    return {
      judgeId: backendResult.judge_id,
      judgeName: backendResult.judge_name,
      score: backendResult.score,
      decision: backendResult.decision as "pass" | "pass_with_warnings" | "fail",
      reasoning: backendResult.reasoning,
      annotations,
      filesReferenced: backendResult.files_referenced || [],
      color,
    };
  });

  const summary: ReviewSummaryFE = {
    overallScore: response.summary.overall_score,
    consensus: response.summary.consensus,
    totalIssues: response.summary.total_issues,
    conflictsDetected: response.summary.conflicts_detected,
  };

  return {
    results,
    summary,
    conflicts: response.conflicts,
    llmMeta: response.llm_meta || [],
  };
}
