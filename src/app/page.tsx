"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  type CommandRunTrace,
  useAppStore,
  type CommentThread,
  type EscalationState,
  type Project,
  type ReviewAnnotation,
  type ReviewResultFE,
  type ReviewSummaryFE,
} from "@/lib/store";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Editor } from "@/components/workspace/Editor";
import { CommandPanel } from "@/components/workspace/CommandPanel";
import { RightPanel } from "@/components/workspace/RightPanel";
import { WelcomeModal } from "@/components/workspace/WelcomeModal";
import { FileSearch } from "@/components/workspace/FileSearch";
import { AnnotationTooltip } from "@/components/workspace/AnnotationTooltip";
import { ThreadBubble } from "@/components/workspace/ThreadBubble";
import { Button } from "@/components/ui/Button";
import { notify } from "@/components/ui/NotificationCenter";
import { runReview } from "@/lib/review-orchestrator";
import type { AnnotationWithColor } from "@/lib/extensions/review-annotations";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { normalizeConnectorProvider } from "@/lib/connectors";
import {
  buildMentionKeys,
  normalizeMentionToken,
  parseMentionTokens,
  stripMentionTokens,
} from "@/lib/mentions";
import { buildLineMap, linesToPositions } from "@/lib/line-position-map";
import {
  execProjectRepl,
  getCrewVersions,
  streamProjectSync,
  type BackendLlmRouteEvent,
} from "@/lib/api";

const DEFAULT_CAPACITY_POLICY = {
  maxConcurrentDoers: 3,
  maxReviewerRunsPerDraft: 5,
  reviewerRunsCurrentDraft: 0,
  queueDepth: 0,
};

function countCriticalIssues(results: ReviewResultFE[]): number {
  let total = 0;
  for (const result of results) {
    total += result.annotations.filter((annotation) => annotation.severity === "critical").length;
  }
  return total;
}

function buildEscalationFromReview(
  summary: ReviewSummaryFE,
  results: ReviewResultFE[]
): EscalationState | null {
  const criticalCount = countCriticalIssues(results);
  if (criticalCount >= 3) {
    return {
      level: "L2",
      trigger: "low_source_confidence",
      reason: `${criticalCount} critical issues found in this review run.`,
      recommended_action: "Pause and verify claims before any external action.",
      status: "open",
      created_at: new Date().toISOString(),
    };
  }
  if (summary.conflictsDetected > 0) {
    return {
      level: "L1",
      trigger: "review_conflict",
      reason: `${summary.conflictsDetected} reviewer conflict(s) detected.`,
      recommended_action: "Review conflicting notes and approve the next revision path.",
      status: "open",
      created_at: new Date().toISOString(),
    };
  }
  if (summary.overallScore < 6 || summary.totalIssues >= 8) {
    return {
      level: "L1",
      trigger: "low_source_confidence",
      reason: `Review score ${summary.overallScore.toFixed(1)}/10 with ${summary.totalIssues} issues.`,
      recommended_action: "Request revision and rerun review before publish/share.",
      status: "open",
      created_at: new Date().toISOString(),
    };
  }
  return null;
}

function hashThreadId(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `thread-${(hash >>> 0).toString(36)}`;
}

function parseReplacementFromMessage(message: string): string | null {
  const quotedMatch = message.match(
    /\b(?:replace|change|rewrite|use)\b[^"'`]*["']([^"']{2,220})["']/i
  );
  const candidate = quotedMatch?.[1]?.trim();
  return candidate ? candidate : null;
}

function buildCommentThreadsFromResults(
  projectId: string,
  results: ReviewResultFE[],
  editor: TiptapEditor
): CommentThread[] {
  const now = new Date().toISOString();
  const threads: CommentThread[] = [];
  const docSize = editor.state.doc.content.size;
  const lineMap = buildLineMap(editor.state.doc);
  const clampPos = (pos: number): number =>
    Math.max(1, Math.min(Math.max(1, docSize), Math.floor(pos)));

  for (const result of results) {
    for (const annotation of result.annotations) {
      const mapped = linesToPositions(lineMap, annotation.startLine, annotation.endLine);
      let startPos = clampPos(annotation.startPos ?? mapped?.from ?? 1);
      let endPos = clampPos(annotation.endPos ?? mapped?.to ?? Math.min(docSize, startPos + 1));
      if (endPos <= startPos && docSize > 1) {
        if (startPos < docSize) {
          endPos = startPos + 1;
        } else {
          startPos = Math.max(1, startPos - 1);
          endPos = Math.max(startPos + 1, endPos);
        }
      }
      const selectedText = editor.state.doc.textBetween(startPos, endPos, "\n", "\n").trim();
      const replacement = parseReplacementFromMessage(annotation.message);
      const suggestion =
        replacement && selectedText && replacement !== selectedText
          ? {
              id: `s-${annotation.id}`,
              kind: "replace_range" as const,
              status: "pending" as const,
              from: startPos,
              to: endPos,
              original_text: selectedText,
              replacement_text: replacement,
            }
          : undefined;

      const key = `${projectId}:${annotation.judgeId}:${annotation.id}`;
      threads.push({
        id: hashThreadId(key),
        key,
        project_id: projectId,
        annotation_id: annotation.id,
        judge_id: annotation.judgeId,
        judge_name: result.judgeName,
        severity: annotation.severity,
        status: "open",
        anchor: {
          startPos,
          endPos,
          startLine: annotation.startLine,
          endLine: annotation.endLine,
        },
        color: result.color,
        messages: [
          {
            id: `m-${annotation.id}`,
            author_type: "reviewer",
            author_name: result.judgeName,
            body: annotation.message,
            created_at: now,
          },
        ],
        suggestion,
        created_at: now,
        updated_at: now,
      });
    }
  }

  const severityOrder: Record<ReviewAnnotation["severity"], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return threads.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      a.anchor.startLine - b.anchor.startLine
  );
}

function nowMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseAssistantOutput(raw: string): { answer: string; reasoning: string | null } {
  if (!raw.trim()) return { answer: "", reasoning: null };

  const reasoningBlocks: string[] = [];
  let cleaned = raw.replace(/<think>([\s\S]*?)<\/think>/gi, (_match, content: string) => {
    const value = content.trim();
    if (value) reasoningBlocks.push(value);
    return "";
  });

  if (reasoningBlocks.length === 0) {
    const start = raw.indexOf("<think>");
    if (start >= 0) {
      const tail = raw.slice(start + "<think>".length);
      const lines = tail.split("\n");
      const answerStart = lines.findIndex(
        (line) =>
          /^(final answer|answer|response)\s*:/i.test(line.trim()) ||
          line.trim().startsWith("</think>")
      );
      const reasoningChunk =
        answerStart >= 0 ? lines.slice(0, answerStart).join("\n") : tail;
      const reasoning = reasoningChunk.trim();
      if (reasoning) reasoningBlocks.push(reasoning);
      cleaned = answerStart >= 0 ? lines.slice(answerStart + 1).join("\n") : "";
    }
  }

  const answer = cleaned
    .replace(/<\/?think>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { answer, reasoning: reasoningBlocks.join("\n\n").trim() || null };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInlineMarkdown(text: string): string {
  let rendered = escapeHtml(text);
  rendered = rendered.replace(/`([^`]+)`/g, "<code>$1</code>");
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  rendered = rendered.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return rendered;
}

function formatOutputAsRichHtml(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const chunks: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let ulItems: string[] = [];
  let olItems: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const content = renderInlineMarkdown(paragraphLines.join(" "));
    chunks.push(`<p>${content}</p>`);
    paragraphLines = [];
  };
  const flushList = () => {
    if (ulItems.length) {
      chunks.push(`<ul>${ulItems.map((item) => `<li>${item}</li>`).join("")}</ul>`);
      ulItems = [];
    }
    if (olItems.length) {
      chunks.push(`<ol>${olItems.map((item) => `<li>${item}</li>`).join("")}</ol>`);
      olItems = [];
    }
  };
  const flushCode = () => {
    if (!codeLines.length) return;
    chunks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      chunks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const ul = trimmed.match(/^[-*]\s+(.+)$/);
    if (ul) {
      flushParagraph();
      olItems = [];
      ulItems.push(renderInlineMarkdown(ul[1]));
      continue;
    }
    const ol = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      flushParagraph();
      ulItems = [];
      olItems.push(renderInlineMarkdown(ol[1]));
      continue;
    }
    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushCode();

  if (!chunks.length) {
    return `<p>${renderInlineMarkdown(text)}</p>`;
  }
  return chunks.join("");
}

export default function Home() {
  const router = useRouter();
  const {
    projects,
    selectedProjectId,
    selectProject,
    updateProject,
    onboarding,
    setOnboarding,
    review,
    startReview,
    setReviewResults,
    clearReview,
    setActiveAnnotation,
    toggleJudgeVisibility,
    updateSingleResult,
    setRunningJudgeId,
    focusMode,
    setFocusMode,
    setGlobalActivity,
    addLlmTelemetryEvent,
    addHubEvent,
    appendDecisionLog,
    setProjectEscalation,
    setProjectCapacity,
  } = useAppStore();

  const selectedProject: Project | undefined = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000",
    []
  );
  const syncInFlightRef = useRef<string | null>(null);
  const crewHydrationRef = useRef<Record<string, string | null>>({});

  // Redirect to onboarding if user hasn't completed profile
  useEffect(() => {
    if (!onboarding.completed) {
      router.push("/onboarding");
      return;
    }
    if (!selectedProject && projects.length > 0) {
      selectProject(projects[0].id);
    }
  }, [projects, selectedProject, selectProject, router, onboarding]);

  useEffect(() => {
    const projectsMissingOps = projects.filter(
      (project) => !project.capacity || project.decisionLog === undefined || project.escalation === undefined
    );
    if (!projectsMissingOps.length) return;
    for (const project of projectsMissingOps) {
      updateProject(project.id, {
        capacity: project.capacity ?? { ...DEFAULT_CAPACITY_POLICY },
        decisionLog: project.decisionLog ?? [],
        escalation: project.escalation ?? null,
      });
    }
  }, [projects, updateProject]);

  const [isRunning, setIsRunning] = useState(false);

  // File search state
  const [showFileSearch, setShowFileSearch] = useState(false);

  // Editor ref
  const editorRef = useRef<TiptapEditor | null>(null);
  const handleEditorRef = useCallback((editor: TiptapEditor | null) => {
    editorRef.current = editor;
  }, []);
  const focusCommandInput = useCallback(() => {
    const input = document.querySelector<HTMLTextAreaElement>('[data-testid="command-input"]');
    if (!input) return;
    input.focus();
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    annotationId: string;
    rect: DOMRect;
  } | null>(null);
  const [threadBubbleRect, setThreadBubbleRect] = useState<DOMRect | null>(null);

  // Welcome modal state
  const showWelcomeModal = onboarding.completed && !onboarding.welcome_dismissed && projects.length > 0;

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        focusCommandInput();
      }
      if (e.metaKey && e.key === "i") {
        e.preventDefault();
        setShowFileSearch((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusCommandInput]);

  useEffect(() => {
    if (!selectedProject) return;
    if (selectedProject.syncStatus !== "syncing") return;
    if (syncInFlightRef.current === selectedProject.id) return;

    const provider = normalizeConnectorProvider(selectedProject.connector);
    if (!provider) return;

    syncInFlightRef.current = selectedProject.id;
    let cancelled = false;

    const runSync = async () => {
      setGlobalActivity({
        title: "Syncing project files",
        detail: `Connecting ${provider} and importing folder contents`,
      });
      try {
        const configureResponse = await fetch(
          `${backendUrl}/v1/projects/${selectedProject.id}/connectors/${provider}/configure`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config: selectedProject.connectorConfig || {} }),
          }
        );
        if (!configureResponse.ok) {
          const errBody = await configureResponse.json().catch(() => ({}));
          throw new Error(errBody?.detail || "Failed to configure connector");
        }

        const syncBody = await streamProjectSync(selectedProject.id, (event, data) => {
          if (cancelled) return;
          if (event === "status" && data && typeof data === "object") {
            const message =
              "message" in data && typeof (data as { message?: unknown }).message === "string"
                ? (data as { message: string }).message
                : "Sync in progress";
            setGlobalActivity({
              title: "Syncing project files",
              detail: message,
            });
            return;
          }
          if (event === "sync_complete" && data && typeof data === "object") {
            const filesAdded =
              "files_added" in data && typeof (data as { files_added?: unknown }).files_added === "number"
                ? (data as { files_added: number }).files_added
                : 0;
            setGlobalActivity({
              title: "Sync complete",
              detail: `${filesAdded} ${filesAdded === 1 ? "file" : "files"} pulled. Starting extraction...`,
            });
            return;
          }
          if (event === "extraction_start" && data && typeof data === "object") {
            const total =
              "total" in data && typeof (data as { total?: unknown }).total === "number"
                ? (data as { total: number }).total
                : 0;
            setGlobalActivity({
              title: "Extracting document text",
              detail: "Preparing AI-ready text from uploaded files",
              progressCurrent: 0,
              progressTotal: total > 0 ? total : undefined,
            });
            return;
          }
          if (event === "extraction_progress" && data && typeof data === "object") {
            const current =
              "current" in data && typeof (data as { current?: unknown }).current === "number"
                ? (data as { current: number }).current
                : 0;
            const total =
              "total" in data && typeof (data as { total?: unknown }).total === "number"
                ? (data as { total: number }).total
                : 0;
            const path =
              "path" in data && typeof (data as { path?: unknown }).path === "string"
                ? (data as { path: string }).path
                : "file";
            const status =
              "status" in data && typeof (data as { status?: unknown }).status === "string"
                ? (data as { status: string }).status
                : "processing";
            setGlobalActivity({
              title: "Extracting document text",
              detail: `${status}: ${path.split("/").pop() || path}`,
              progressCurrent: current,
              progressTotal: total > 0 ? total : undefined,
            });
            return;
          }
          if (event === "extraction_complete" && data && typeof data === "object") {
            const summary =
              "summary" in data && typeof (data as { summary?: unknown }).summary === "object"
                ? ((data as { summary: { extracted?: number; cached?: number } }).summary || {})
                : {};
            const extracted = Number(summary.extracted ?? 0);
            const cached = Number(summary.cached ?? 0);
            setGlobalActivity({
              title: "Extraction complete",
              detail: `${extracted} extracted, ${cached} reused from cache`,
            });
          }
        });

        const filesResponse = await fetch(`${backendUrl}/v1/projects/${selectedProject.id}/files`);
        const filesBody = await filesResponse.json().catch(() => ({}));
        if (!filesResponse.ok) {
          throw new Error(filesBody?.detail || "Files synced but listing failed");
        }

        if (cancelled) return;
        updateProject(selectedProject.id, {
          syncStatus: "done",
          files: filesBody.files || [],
        });

        const count = Number(syncBody.files_added ?? filesBody.count ?? 0);
        const extractedCount = Number(syncBody.summary?.extracted ?? 0);
        notify.success(
          "Files Synced",
          `${count} ${count === 1 ? "file" : "files"} ready, ${extractedCount} extracted for AI context`
        );
      } catch (error) {
        if (cancelled) return;
        console.error("Sync failed:", error);
        updateProject(selectedProject.id, { syncStatus: "idle" });
        notify.error("Sync Failed", error instanceof Error ? error.message : "Unable to sync files");
      } finally {
        if (!cancelled) {
          setGlobalActivity(null);
        }
        syncInFlightRef.current = null;
      }
    };

    void runSync();

    return () => {
      cancelled = true;
    };
  }, [backendUrl, selectedProject, setGlobalActivity, updateProject]);

  const appendProjectDecision = useCallback(
    (
      projectId: string,
      event: Parameters<typeof appendDecisionLog>[1]
    ) => {
      appendDecisionLog(projectId, event);
    },
    [appendDecisionLog]
  );

  const openEscalation = useCallback(
    (projectId: string, escalation: EscalationState) => {
      setProjectEscalation(projectId, escalation);
      appendProjectDecision(projectId, {
        actor_type: "system",
        actor_id: "ops_guard",
        decision_type: "escalation_opened",
        reason: escalation.reason,
        impact_summary: `${escalation.level} escalation opened: ${escalation.recommended_action}`,
        metadata: {
          trigger: escalation.trigger,
          level: escalation.level,
        },
      });
    },
    [appendProjectDecision, setProjectEscalation]
  );

  const resolveEscalation = useCallback(
    (projectId: string, reason: string) => {
      setProjectEscalation(projectId, null);
      appendProjectDecision(projectId, {
        actor_type: "system",
        actor_id: "ops_guard",
        decision_type: "escalation_resolved",
        reason,
        impact_summary: "Escalation resolved and project returned to normal flow.",
      });
    },
    [appendProjectDecision, setProjectEscalation]
  );

  const updateThreadState = useCallback(
    (threadId: string, updater: (thread: CommentThread) => CommentThread) => {
      if (!selectedProject) return null;
      const threads = selectedProject.commentThreads ?? [];
      let updatedThread: CommentThread | null = null;
      const nextThreads = threads.map((thread) => {
        if (thread.id !== threadId) return thread;
        updatedThread = updater(thread);
        return updatedThread;
      });
      if (!updatedThread) return null;
      updateProject(selectedProject.id, { commentThreads: nextThreads });
      return updatedThread;
    },
    [selectedProject, updateProject]
  );

  const selectThread = useCallback(
    (threadId: string, rect?: DOMRect) => {
      if (!selectedProject) return;
      let resolvedRect = rect ?? null;
      if (!resolvedRect && typeof document !== "undefined") {
        const marker = document.querySelector<HTMLElement>(`[data-thread-id="${threadId}"]`);
        resolvedRect = marker?.getBoundingClientRect() ?? null;
      }
      if (!resolvedRect) {
        const thread = (selectedProject.commentThreads ?? []).find((item) => item.id === threadId);
        const pos = thread?.anchor.startPos;
        if (pos != null && editorRef.current?.view) {
          const view = editorRef.current.view;
          const safePos = Math.max(1, Math.min(pos, view.state.doc.content.size));
          const coords = view.coordsAtPos(safePos);
          resolvedRect = new DOMRect(
            coords.left,
            coords.top,
            Math.max(1, coords.right - coords.left),
            Math.max(1, coords.bottom - coords.top)
          );
        }
      }
      updateProject(selectedProject.id, { activeThreadId: threadId });
      setThreadBubbleRect(resolvedRect);
    },
    [selectedProject, updateProject]
  );

  const closeActiveThread = useCallback(() => {
    if (!selectedProject) return;
    updateProject(selectedProject.id, { activeThreadId: null });
    setThreadBubbleRect(null);
  }, [selectedProject, updateProject]);

  const handleAcceptThreadSuggestion = useCallback(
    (threadId: string) => {
      const editor = editorRef.current;
      if (!selectedProject || !editor) return;
      const thread = (selectedProject.commentThreads ?? []).find((item) => item.id === threadId);
      const suggestion = thread?.suggestion;
      if (!thread || !suggestion || suggestion.status !== "pending") return;

      editor
        .chain()
        .focus()
        .insertContentAt({ from: suggestion.from, to: suggestion.to }, suggestion.replacement_text)
        .run();
      const now = new Date().toISOString();
      const appliedTo = suggestion.from + suggestion.replacement_text.length;

      updateThreadState(threadId, (current) => ({
        ...current,
        updated_at: now,
        anchor: {
          ...current.anchor,
          endPos: appliedTo,
        },
        suggestion: {
          ...suggestion,
          status: "accepted",
          applied_from: suggestion.from,
          applied_to: appliedTo,
          applied_at: now,
        },
        messages: [
          ...current.messages,
          {
            id: nowMessageId(),
            author_type: "system",
            author_name: "System",
            body: "Suggestion accepted and applied.",
            created_at: now,
          },
        ],
      }));
      appendProjectDecision(selectedProject.id, {
        actor_type: "human",
        actor_id: "current_user",
        decision_type: "approve",
        reason: `Accepted reviewer suggestion in ${thread.judge_name || "thread"}.`,
        evidence_refs: thread.annotation_id ? [thread.annotation_id] : undefined,
        impact_summary: "Applied reviewer text replacement in editor.",
      });
      notify.success("Suggestion Applied", "Reviewer suggestion has been inserted in the editor.");
      selectThread(threadId);
    },
    [appendProjectDecision, selectThread, selectedProject, updateThreadState]
  );

  const handleRejectThreadSuggestion = useCallback(
    (threadId: string) => {
      if (!selectedProject) return;
      const thread = (selectedProject.commentThreads ?? []).find((item) => item.id === threadId);
      const suggestion = thread?.suggestion;
      if (!thread || !suggestion || suggestion.status !== "pending") return;
      const now = new Date().toISOString();

      updateThreadState(threadId, (current) => ({
        ...current,
        updated_at: now,
        suggestion: {
          ...suggestion,
          status: "rejected",
        },
        messages: [
          ...current.messages,
          {
            id: nowMessageId(),
            author_type: "human",
            author_name: "You",
            body: "Suggestion rejected.",
            created_at: now,
          },
        ],
      }));
      appendProjectDecision(selectedProject.id, {
        actor_type: "human",
        actor_id: "current_user",
        decision_type: "reject",
        reason: `Rejected reviewer suggestion in ${thread.judge_name || "thread"}.`,
        evidence_refs: thread.annotation_id ? [thread.annotation_id] : undefined,
        impact_summary: "Kept current editor text unchanged.",
      });
      notify.info("Suggestion Rejected", "Reviewer suggestion was marked as rejected.");
    },
    [appendProjectDecision, selectedProject, updateThreadState]
  );

  const handleRevertThreadSuggestion = useCallback(
    (threadId: string) => {
      const editor = editorRef.current;
      if (!selectedProject || !editor) return;
      const thread = (selectedProject.commentThreads ?? []).find((item) => item.id === threadId);
      const suggestion = thread?.suggestion;
      if (!thread || !suggestion || suggestion.status !== "accepted") return;

      const from = suggestion.applied_from ?? suggestion.from;
      const to = suggestion.applied_to ?? from + suggestion.replacement_text.length;

      editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, suggestion.original_text)
        .run();

      const now = new Date().toISOString();
      const restoredTo = from + suggestion.original_text.length;
      updateThreadState(threadId, (current) => ({
        ...current,
        updated_at: now,
        anchor: {
          ...current.anchor,
          endPos: restoredTo,
        },
        suggestion: {
          ...suggestion,
          status: "reverted",
          applied_from: from,
          applied_to: restoredTo,
          applied_at: now,
        },
        messages: [
          ...current.messages,
          {
            id: nowMessageId(),
            author_type: "system",
            author_name: "System",
            body: "Accepted suggestion reverted to original text.",
            created_at: now,
          },
        ],
      }));
      appendProjectDecision(selectedProject.id, {
        actor_type: "human",
        actor_id: "current_user",
        decision_type: "override",
        reason: `Reverted accepted suggestion in ${thread.judge_name || "thread"}.`,
        evidence_refs: thread.annotation_id ? [thread.annotation_id] : undefined,
        impact_summary: "Restored the original text span.",
      });
      notify.info("Suggestion Reverted", "Original text has been restored.");
      selectThread(threadId);
    },
    [appendProjectDecision, selectThread, selectedProject, updateThreadState]
  );

  const handleResolveThread = useCallback(
    (threadId: string) => {
      if (!selectedProject) return;
      const thread = (selectedProject.commentThreads ?? []).find((item) => item.id === threadId);
      if (!thread) return;
      const now = new Date().toISOString();
      updateThreadState(threadId, (current) => ({
        ...current,
        status: "resolved",
        updated_at: now,
        messages: [
          ...current.messages,
          {
            id: nowMessageId(),
            author_type: "human",
            author_name: "You",
            body: "Thread resolved.",
            created_at: now,
          },
        ],
      }));
      if (selectedProject.activeThreadId === threadId) {
        closeActiveThread();
      }
      appendProjectDecision(selectedProject.id, {
        actor_type: "human",
        actor_id: "current_user",
        decision_type: "route_change",
        reason: `Resolved thread from ${thread.judge_name || "reviewer"}.`,
        evidence_refs: thread.annotation_id ? [thread.annotation_id] : undefined,
        impact_summary: "Reviewer thread moved out of active queue.",
      });
    },
    [appendProjectDecision, closeActiveThread, selectedProject, updateThreadState]
  );

  const handleRunCommand = useCallback(async (prompt: string, model: string) => {
    if (!selectedProject) {
      notify.warning("No Project Selected", "Select a project before running a command.");
      return;
    }

    const tags = parseMentionTokens(prompt);
    const doerMap = new Map<string, { id: string; name: string; systemPrompt?: string }>();
    for (const doer of selectedProject.doers || []) {
      const entry = { id: doer.id, name: doer.name, systemPrompt: doer.system_prompt };
      for (const key of buildMentionKeys(doer.id, doer.name)) {
        doerMap.set(key, entry);
      }
    }
    const reviewerMap = new Map<string, { id: string; name: string }>();
    for (const reviewer of selectedProject.reviewers || []) {
      const entry = { id: reviewer.id, name: reviewer.name };
      for (const key of buildMentionKeys(reviewer.id, reviewer.name)) {
        reviewerMap.set(key, entry);
      }
    }

    const mentionedDoers: Array<{ id: string; name: string; systemPrompt?: string }> = [];
    const mentionedReviewers: Array<{ id: string; name: string }> = [];
    const seenDoers = new Set<string>();
    const seenReviewers = new Set<string>();
    for (const tag of tags) {
      const normalized = normalizeMentionToken(tag);
      const doer = doerMap.get(normalized);
      if (doer && !seenDoers.has(doer.id)) {
        seenDoers.add(doer.id);
        mentionedDoers.push(doer);
        continue;
      }
      const reviewer = reviewerMap.get(normalized);
      if (reviewer && !seenReviewers.has(reviewer.id)) {
        seenReviewers.add(reviewer.id);
        mentionedReviewers.push(reviewer);
      }
    }

    const cleanPrompt = stripMentionTokens(prompt);
    if (!cleanPrompt) {
      notify.warning("Add an Instruction", "Include a command after any @mentions.");
      return;
    }

    const doerSystemPrompt = mentionedDoers
      .map((doer) => {
        const source = (selectedProject.doers || []).find((item) => item.id === doer.id);
        const tools = source?.tools || [];
        const toolsBlock =
          tools.length > 0
            ? `\n\nAvailable tools:\n${tools
                .map(
                  (tool, index) =>
                    `${index + 1}. ${tool.tool_name}: ${tool.tool_description} -> ${tool.tool_output}`
                )
                .join("\n")}`
            : "";
        if (!doer.systemPrompt) {
          return `Doer: ${doer.name}${toolsBlock}`;
        }
        return `Doer: ${doer.name}\n${doer.systemPrompt}${toolsBlock}`;
      })
      .filter((value): value is string => Boolean(value))
      .join("\n\n");
    const reviewerSystemPrompt = mentionedReviewers
      .map((reviewer) => {
        const source = (selectedProject.reviewers || []).find((item) => item.id === reviewer.id);
        const tools = source?.tools || [];
        const toolsBlock =
          tools.length > 0
            ? `\n\nAvailable tools:\n${tools
                .map(
                  (tool, index) =>
                    `${index + 1}. ${tool.tool_name}: ${tool.tool_description} -> ${tool.tool_output}`
                )
                .join("\n")}`
            : "";
        if (!source?.system_prompt) {
          return `Reviewer: ${reviewer.name}${toolsBlock}`;
        }
        return `Reviewer: ${reviewer.name}\n${source.system_prompt}${toolsBlock}`;
      })
      .filter((value): value is string => Boolean(value))
      .join("\n\n");
    const combinedSystemPrompt = [doerSystemPrompt, reviewerSystemPrompt]
      .filter((value) => value && value.trim().length > 0)
      .join("\n\n");

    const externalActionPattern = /\b(send|email|post|publish|export|share|notify)\b/i;
    const hasExternalActionRequest = externalActionPattern.test(cleanPrompt);
    if (hasExternalActionRequest && typeof window !== "undefined") {
      openEscalation(selectedProject.id, {
        level: "L2",
        trigger: "external_action",
        reason: "Command appears to trigger an external action.",
        recommended_action: "Require explicit human confirmation before continuing.",
        status: "open",
        created_at: new Date().toISOString(),
      });
      const confirmed = window.confirm(
        "This request may trigger an external action. Continue?"
      );
      if (!confirmed) {
        appendProjectDecision(selectedProject.id, {
          actor_type: "human",
          actor_id: "current_user",
          decision_type: "pause",
          reason: "External action not approved.",
          impact_summary: "Command execution cancelled before external side effects.",
        });
        notify.info("Action Cancelled", "External action requires explicit confirmation.");
        return;
      }
      appendProjectDecision(selectedProject.id, {
        actor_type: "human",
        actor_id: "current_user",
        decision_type: "override",
        reason: "External action explicitly approved.",
        impact_summary: "Command execution continued after manual approval.",
      });
    }

    const targetNames = [...mentionedDoers.map((d) => d.name), ...mentionedReviewers.map((r) => r.name)];
    if (targetNames.length) {
      notify.info("Targeted Run", `Routing command to: ${targetNames.join(", ")}`);
    }
    if (model && model !== "auto") {
      notify.info("Model Override", `Using ${model} for this command`);
    }

    const escapedPrompt = JSON.stringify(cleanPrompt);
    const escapedModel = JSON.stringify(model || "auto");
    const escapedSystemPrompt = combinedSystemPrompt ? JSON.stringify(combinedSystemPrompt) : null;
    const code = escapedSystemPrompt
      ? `print(ask_llm(${escapedPrompt}, model=${escapedModel}, system_prompt=${escapedSystemPrompt}))`
      : `print(ask_llm(${escapedPrompt}, model=${escapedModel}))`;

    setIsRunning(true);
    try {
      const response = await execProjectRepl(selectedProject.id, { code });
      const llmEvents = response.llm_meta || [];
      for (const event of llmEvents) {
        addLlmTelemetryEvent({
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          task: event.task,
          timestamp: new Date().toISOString(),
          winner_provider: event.provider,
          winner_model: event.model,
          fallback_used: event.fallback_used,
          rollout_mode: event.rollout_mode,
          attempts: (event.attempts || []).map((attempt) => ({
            provider: attempt.provider,
            model: attempt.model,
            success: attempt.success,
            latency_ms: attempt.latency_ms,
            error: attempt.error,
          })),
        });
      }
      if (response.error) {
        throw new Error(response.error);
      }

      const rawOutput = (response.stdout || "").trim();
      const parsedOutput = parseAssistantOutput(rawOutput);
      const output =
        parsedOutput.answer ||
        (parsedOutput.reasoning
          ? "No direct answer returned. Open Last Run in the right panel for reasoning and source context."
          : rawOutput);
      if (output) {
        const editor = editorRef.current;
        if (editor) {
          const richHtml = formatOutputAsRichHtml(output);
          editor.chain().focus().insertContent("<p></p>").insertContent(richHtml).run();
          const hasReasoning = Boolean(parsedOutput.reasoning);
          notify.success(
            "Command Complete",
            hasReasoning
              ? "Inserted answer. Reasoning and sources are available in Last Run."
              : "Inserted output into the editor."
          );
        } else {
          notify.success("Command Complete", output.slice(0, 220));
        }
      } else {
        notify.info("Command Complete", "No output returned.");
      }

      const contextFileSet = new Set<string>();
      let contextFileCount = 0;
      const toolCallList: Array<{
        tool_name: string;
        source: string;
        file?: string | null;
        status?: string;
        bytes_read?: number | null;
        timestamp?: string | null;
      }> = [];
      const contextSummaryByFile = new Map<string, { filename: string; chars: number; preview: string }>();
      const citationKeySet = new Set<string>();
      const citations: Array<{
        filename: string;
        quote: string;
        why?: string;
        line_start?: number | null;
        line_end?: number | null;
      }> = [];
      const evidenceGapSet = new Set<string>();
      for (const event of llmEvents) {
        const files = Array.isArray(event.context_files) ? event.context_files : [];
        for (const file of files) {
          if (typeof file === "string" && file.trim()) contextFileSet.add(file);
        }
        const summaries = Array.isArray(event.context_file_summaries) ? event.context_file_summaries : [];
        for (const summary of summaries) {
          if (!summary?.filename) continue;
          contextSummaryByFile.set(summary.filename, {
            filename: summary.filename,
            chars: typeof summary.chars === "number" ? summary.chars : 0,
            preview: summary.preview || "",
          });
        }
        const eventCitations = Array.isArray(event.citations) ? event.citations : [];
        for (const citation of eventCitations) {
          if (!citation?.filename || !citation?.quote) continue;
          const key = `${citation.filename}:${citation.quote}`;
          if (citationKeySet.has(key)) continue;
          citationKeySet.add(key);
          citations.push({
            filename: citation.filename,
            quote: citation.quote,
            why: citation.why,
            line_start: citation.line_start,
            line_end: citation.line_end,
          });
        }
        const gaps = Array.isArray(event.evidence_gaps) ? event.evidence_gaps : [];
        for (const gap of gaps) {
          if (typeof gap === "string" && gap.trim()) evidenceGapSet.add(gap.trim());
        }
        const toolCalls = Array.isArray(event.tool_calls) ? event.tool_calls : [];
        for (const call of toolCalls) {
          if (!call?.tool_name || !call?.source) continue;
          toolCallList.push({
            tool_name: call.tool_name,
            source: call.source,
            file: call.file,
            status: call.status,
            bytes_read: call.bytes_read,
            timestamp: call.timestamp,
          });
        }
        if (typeof event.context_file_count === "number") {
          contextFileCount += event.context_file_count;
        }
      }
      const lastEvent = llmEvents[llmEvents.length - 1];
      const trace: CommandRunTrace = {
        trace_id: lastEvent?.trace_id,
        created_at: new Date().toISOString(),
        model: lastEvent?.model || model || "auto",
        provider: lastEvent?.provider,
        answer_preview: (parsedOutput.answer || rawOutput).slice(0, 180),
        reasoning: parsedOutput.reasoning || undefined,
        reasoning_summary: lastEvent?.reasoning_summary || undefined,
        context_files: Array.from(contextFileSet),
        context_file_count: contextFileCount || contextFileSet.size,
        context_file_summaries: Array.from(contextSummaryByFile.values()),
        citations,
        evidence_gaps: Array.from(evidenceGapSet),
        tool_calls: toolCallList,
      };
      updateProject(selectedProject.id, {
        lastCommandTrace: trace,
      });

      const promptSummary =
        cleanPrompt.length > 96 ? `${cleanPrompt.slice(0, 96)}...` : cleanPrompt;
      if (mentionedDoers.length > 0) {
        for (const doer of mentionedDoers) {
          addHubEvent({
            project_id: selectedProject.id,
            project_name: selectedProject.name,
            actor_type: "doer",
            actor_name: doer.name,
            message: `Finished "${promptSummary}" in project "${selectedProject.name}".`,
            status: "completed",
          });
        }
      } else {
        addHubEvent({
          project_id: selectedProject.id,
          project_name: selectedProject.name,
          actor_type: "system",
          actor_name: "REPL",
          message: `Finished "${promptSummary}" in project "${selectedProject.name}".`,
          status: "completed",
        });
      }
      appendProjectDecision(selectedProject.id, {
        actor_type: "system",
        actor_id: "repl",
        decision_type: "route_change",
        reason: "Command executed in project REPL.",
        impact_summary: `Processed prompt "${promptSummary}" using model ${model || "auto"}.`,
        metadata: {
          model: model || "auto",
          targeted_doers: mentionedDoers.map((doer) => doer.id),
          targeted_reviewers: mentionedReviewers.map((reviewer) => reviewer.id),
        },
      });
      if (hasExternalActionRequest) {
        resolveEscalation(selectedProject.id, "External action approval completed.");
      }

      setIsRunning(false);
    } catch (error) {
      setIsRunning(false);
      notify.error(
        "Command Failed",
        error instanceof Error ? error.message : "Failed to run command in REPL"
      );
    }
  }, [
    addHubEvent,
    addLlmTelemetryEvent,
    appendProjectDecision,
    openEscalation,
    resolveEscalation,
    selectedProject,
    updateProject,
  ]);

  const getProfileContext = useCallback(() => {
    if (onboarding.user_profile) {
      return {
        job_function: onboarding.user_profile.job_function,
        team_size: onboarding.user_profile.team_size,
        reporting_level: onboarding.user_profile.reporting_level,
        industry: onboarding.user_profile.industry,
        company_stage: onboarding.user_profile.company_stage,
        current_work: onboarding.user_profile.current_work,
      };
    }
    if (typeof window === "undefined") return undefined;
    try {
      const raw = localStorage.getItem("user_profile");
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      return {
        job_function: parsed.job_function,
        team_size: parsed.team_size,
        reporting_level: parsed.reporting_level,
        industry: parsed.industry,
        company_stage: parsed.company_stage,
        current_work: parsed.current_work,
      };
    } catch {
      return undefined;
    }
  }, [onboarding.user_profile]);

  const pushLlmMetaEvents = useCallback(
    (events: BackendLlmRouteEvent[]) => {
      for (const event of events) {
        addLlmTelemetryEvent({
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          task: event.task,
          timestamp: new Date().toISOString(),
          winner_provider: event.provider,
          winner_model: event.model,
          fallback_used: event.fallback_used,
          rollout_mode: event.rollout_mode,
          attempts: (event.attempts || []).map((attempt) => ({
            provider: attempt.provider,
            model: attempt.model,
            success: attempt.success,
            latency_ms: attempt.latency_ms,
            error: attempt.error,
          })),
        });
      }
    },
    [addLlmTelemetryEvent]
  );

  const hydrateProjectCrew = useCallback(
    async (projectId: string) => {
      try {
        const history = await getCrewVersions(projectId);
        const activeVersionId = history.active_version_id ?? null;
        const activeVersion = activeVersionId
          ? history.versions.find((version) => version.version_id === activeVersionId)
          : history.versions[0];
        if (!activeVersion) {
          crewHydrationRef.current[projectId] = activeVersionId;
          return;
        }

        const updates: Partial<Project> = {
          active_crew_version_id: activeVersion.version_id,
        };
        if (Array.isArray(activeVersion.doers)) {
          updates.doers = activeVersion.doers;
        }
        if (Array.isArray(activeVersion.reviewers)) {
          updates.reviewers = activeVersion.reviewers;
        }
        updateProject(projectId, updates);
        crewHydrationRef.current[projectId] = activeVersion.version_id;
      } catch (err) {
        console.warn("Failed to hydrate crew versions", err);
      }
    },
    [updateProject]
  );

  useEffect(() => {
    if (!selectedProject?.id) return;
    const projectId = selectedProject.id;
    const doerCount = selectedProject.doers?.length || 0;
    const reviewerCount = selectedProject.reviewers?.length || 0;
    const currentVersion = selectedProject.active_crew_version_id || null;
    const hydratedVersion = crewHydrationRef.current[projectId] ?? null;

    const shouldHydrate =
      !hydratedVersion ||
      hydratedVersion !== currentVersion ||
      doerCount === 0 ||
      reviewerCount === 0;
    if (!shouldHydrate) return;

    void hydrateProjectCrew(projectId);
  }, [
    hydrateProjectCrew,
    selectedProject?.active_crew_version_id,
    selectedProject?.doers?.length,
    selectedProject?.id,
    selectedProject?.reviewers?.length,
  ]);

  // --- Review handlers ---

  const handleRunReview = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || !selectedProject) return;

    // Get judge IDs from project reviewers, or use defaults
    const judgeIds = selectedProject.reviewers
      ?.filter((r) => r.enabled)
      .map((r) => r.id) ?? ["brand_consistency", "legal_compliance"];

    const capacity = selectedProject.capacity ?? DEFAULT_CAPACITY_POLICY;
    const nextRunCount = (capacity.reviewerRunsCurrentDraft || 0) + 1;
    if (nextRunCount > capacity.maxReviewerRunsPerDraft) {
      const allowOverride =
        typeof window !== "undefined"
          ? window.confirm(
              `Reviewer run limit reached (${capacity.maxReviewerRunsPerDraft} per draft). Continue anyway?`
            )
          : false;
      if (!allowOverride) {
        setProjectCapacity(selectedProject.id, {
          queueDepth: (capacity.queueDepth || 0) + 1,
        });
        appendProjectDecision(selectedProject.id, {
          actor_type: "system",
          actor_id: "capacity_guard",
          decision_type: "capacity_queue",
          reason: "Reviewer run budget exceeded for current draft.",
          impact_summary: "Review run queued until user override or next draft reset.",
          metadata: {
            maxReviewerRunsPerDraft: capacity.maxReviewerRunsPerDraft,
            attemptedRuns: nextRunCount,
          },
        });
        notify.warning("Review Queued", "Reviewer run limit reached. Approve override to continue.");
        return;
      }
      appendProjectDecision(selectedProject.id, {
        actor_type: "human",
        actor_id: "current_user",
        decision_type: "capacity_override",
        reason: "User approved reviewer run beyond configured budget.",
        impact_summary: "Review run continued beyond capacity policy.",
        metadata: {
          maxReviewerRunsPerDraft: capacity.maxReviewerRunsPerDraft,
          attemptedRuns: nextRunCount,
        },
      });
    }
    setProjectCapacity(selectedProject.id, {
      reviewerRunsCurrentDraft: nextRunCount,
      queueDepth: Math.max(0, (capacity.queueDepth || 0) - 1),
    });

    startReview();

    try {
      const { results, summary, conflicts, llmMeta } = await runReview(
        editor,
        judgeIds,
        selectedProject.id,
        {
          profileContext: getProfileContext(),
          reviewerContext: selectedProject.reviewers,
        }
      );
      setReviewResults(results, summary, conflicts);
      const generatedThreads = buildCommentThreadsFromResults(
        selectedProject.id,
        results,
        editor
      );
      updateProject(selectedProject.id, {
        commentThreads: generatedThreads,
        activeThreadId: null,
      });
      setThreadBubbleRect(null);
      pushLlmMetaEvents(llmMeta);
      appendProjectDecision(selectedProject.id, {
        actor_type: "reviewer",
        actor_id: "reviewer_cycle",
        decision_type: "review_cycle",
        reason: "Completed full reviewer cycle.",
        evidence_refs: results
          .flatMap((result) => result.annotations)
          .slice(0, 3)
          .map((annotation) => annotation.id),
        impact_summary: `Score ${summary.overallScore.toFixed(1)}/10 with ${summary.totalIssues} issue(s).`,
      });

      const escalation = buildEscalationFromReview(summary, results);
      if (escalation) {
        openEscalation(selectedProject.id, escalation);
      } else if (selectedProject.escalation?.status === "open") {
        resolveEscalation(selectedProject.id, "Latest review cycle returned to acceptable risk level.");
      }

      // Show notification
      const issueCount = summary.totalIssues;
      const score = summary.overallScore.toFixed(1);
      if (issueCount === 0) {
        notify.success("Review Complete", `All clear! Score: ${score}/10`);
      } else if (summary.overallScore >= 7) {
        notify.info(
          "Review Complete",
          `${issueCount} ${issueCount === 1 ? "issue" : "issues"} found. Score: ${score}/10`
        );
      } else {
        notify.warning(
          "Review Complete",
          `${issueCount} ${issueCount === 1 ? "issue" : "issues"} need attention. Score: ${score}/10`
        );
      }
      addHubEvent({
        project_id: selectedProject.id,
        project_name: selectedProject.name,
        actor_type: "reviewer",
        actor_name: "Reviewer Cycle",
        message: `Completed review run: ${issueCount} issue${issueCount === 1 ? "" : "s"} found.`,
        status: issueCount > 0 ? "warning" : "completed",
      });
    } catch (err) {
      console.error("Review failed:", err);
      clearReview();
      updateProject(selectedProject.id, { commentThreads: [], activeThreadId: null });
      setThreadBubbleRect(null);
      notify.error("Review Failed", err instanceof Error ? err.message : "Is the backend running?");
      openEscalation(selectedProject.id, {
        level: "L1",
        trigger: "retry_exhausted",
        reason: "Reviewer run failed unexpectedly.",
        recommended_action: "Check backend health and retry review.",
        status: "open",
        created_at: new Date().toISOString(),
      });
    }
  }, [
    appendProjectDecision,
    resolveEscalation,
    openEscalation,
    setProjectCapacity,
    selectedProject,
    startReview,
    setReviewResults,
    clearReview,
    addHubEvent,
    getProfileContext,
    pushLlmMetaEvents,
    updateProject,
  ]);

  const handleRunSingleReview = useCallback(
    async (judgeId: string) => {
      const editor = editorRef.current;
      if (!editor || !selectedProject) return;

      const capacity = selectedProject.capacity ?? DEFAULT_CAPACITY_POLICY;
      const nextRunCount = (capacity.reviewerRunsCurrentDraft || 0) + 1;
      if (nextRunCount > capacity.maxReviewerRunsPerDraft) {
        const allowOverride =
          typeof window !== "undefined"
            ? window.confirm(
                `Reviewer run limit reached (${capacity.maxReviewerRunsPerDraft} per draft). Continue anyway?`
              )
            : false;
        if (!allowOverride) {
          setProjectCapacity(selectedProject.id, {
            queueDepth: (capacity.queueDepth || 0) + 1,
          });
          appendProjectDecision(selectedProject.id, {
            actor_type: "system",
            actor_id: "capacity_guard",
            decision_type: "capacity_queue",
            reason: `Single reviewer run queued for ${judgeId}.`,
            impact_summary: "Reviewer budget exceeded for current draft.",
            metadata: {
              maxReviewerRunsPerDraft: capacity.maxReviewerRunsPerDraft,
              attemptedRuns: nextRunCount,
            },
          });
          notify.warning("Review Queued", "Reviewer run limit reached. Approve override to continue.");
          return;
        }
        appendProjectDecision(selectedProject.id, {
          actor_type: "human",
          actor_id: "current_user",
          decision_type: "capacity_override",
          reason: `User approved extra reviewer run for ${judgeId}.`,
          impact_summary: "Single reviewer run continued beyond capacity policy.",
        });
      }
      setProjectCapacity(selectedProject.id, {
        reviewerRunsCurrentDraft: nextRunCount,
        queueDepth: Math.max(0, (capacity.queueDepth || 0) - 1),
      });

      setRunningJudgeId(judgeId);

      try {
        const { results, llmMeta } = await runReview(
          editor,
          [judgeId],
          selectedProject.id,
          {
            profileContext: getProfileContext(),
            reviewerContext: selectedProject.reviewers,
          }
        );
        pushLlmMetaEvents(llmMeta);
        if (results.length > 0) {
          updateSingleResult(results[0]);
          const r = results[0];
          const mergedResults = [
            ...review.results.filter((result) => result.judgeId !== r.judgeId),
            r,
          ];
          const generatedThreads = buildCommentThreadsFromResults(
            selectedProject.id,
            mergedResults,
            editor
          );
          updateProject(selectedProject.id, {
            commentThreads: generatedThreads,
            activeThreadId: null,
          });
          setThreadBubbleRect(null);
          notify.info(
            `${r.judgeName}`,
            `Score: ${r.score.toFixed(1)}/10 — ${r.annotations.length} annotations`
          );
          addHubEvent({
            project_id: selectedProject.id,
            project_name: selectedProject.name,
            actor_type: "reviewer",
            actor_name: r.judgeName,
            message: `Completed single review with score ${r.score.toFixed(1)}/10.`,
            status: r.annotations.length > 0 ? "warning" : "completed",
          });
          appendProjectDecision(selectedProject.id, {
            actor_type: "reviewer",
            actor_id: r.judgeId,
            decision_type: "review_cycle",
            reason: "Completed single reviewer run.",
            evidence_refs: r.annotations.slice(0, 3).map((annotation) => annotation.id),
            impact_summary: `${r.judgeName} scored ${r.score.toFixed(1)}/10 with ${r.annotations.length} issue(s).`,
          });
        }
      } catch (err) {
        console.error("Single reviewer run failed:", err);
        setRunningJudgeId(null);
        notify.error("Review Failed", err instanceof Error ? err.message : "Is the backend running?");
      }
    },
    [
      review.results,
      selectedProject,
      setRunningJudgeId,
      updateSingleResult,
      addHubEvent,
      appendProjectDecision,
      getProfileContext,
      pushLlmMetaEvents,
      setProjectCapacity,
      updateProject,
    ]
  );

  const handleAnnotationClick = useCallback(
    (annotationId: string) => {
      const editor = editorRef.current;
      if (!selectedProject) return;

      // Find the annotation
      const ann = review.results
        .flatMap((r) => r.annotations)
        .find((a) => a.id === annotationId);
      const linkedThread = (selectedProject.commentThreads || []).find(
        (thread) => thread.annotation_id === annotationId && thread.status === "open"
      );
      const focusPos = ann?.startPos ?? linkedThread?.anchor.startPos;

      if (focusPos != null && editor) {
        // Scroll editor to annotation
        editor.commands.focus();
        editor.commands.setTextSelection(focusPos);

        // Highlight for 2 seconds
        setActiveAnnotation(annotationId);
        setTimeout(() => setActiveAnnotation(null), 2000);
      }
      if (linkedThread) {
        selectThread(linkedThread.id);
      }
    },
    [review.results, selectedProject, selectThread, setActiveAnnotation]
  );

  const handleAnnotationHover = useCallback(
    (annotationId: string | null, rect?: DOMRect) => {
      if (annotationId && rect) {
        setTooltip({ annotationId, rect });
      } else {
        setTooltip(null);
      }
    },
    []
  );

  const handleClearReview = useCallback(() => {
    clearReview();
    if (selectedProject) {
      updateProject(selectedProject.id, { commentThreads: [], activeThreadId: null });
    }
    setThreadBubbleRect(null);
    setTooltip(null);
  }, [clearReview, selectedProject, updateProject]);

  // Build flat annotation array for the editor (only visible judges)
  const editorAnnotations: AnnotationWithColor[] = useMemo(() => {
    return review.results
      .filter((r) => review.visibleJudgeIds.has(r.judgeId))
      .flatMap((r) =>
        r.annotations.map((ann) => ({
          ...ann,
          color: r.color,
        }))
      );
  }, [review.results, review.visibleJudgeIds]);

  // Find tooltip annotation data
  const tooltipData = useMemo(() => {
    if (!tooltip) return null;
    for (const result of review.results) {
      const ann = result.annotations.find((a) => a.id === tooltip.annotationId);
      if (ann) {
        return { annotation: ann, judgeName: result.judgeName, color: result.color };
      }
    }
    return null;
  }, [tooltip, review.results]);

  const activeThreadId = selectedProject?.activeThreadId ?? null;
  const activeThread = useMemo(() => {
    if (!selectedProject || !activeThreadId) return null;
    return (selectedProject.commentThreads ?? []).find((thread) => thread.id === activeThreadId) ?? null;
  }, [selectedProject, activeThreadId]);

  const handleThreadClick = useCallback(
    (threadId: string, rect?: DOMRect) => {
      selectThread(threadId, rect);
    },
    [selectThread]
  );

  const handleThreadHover = useCallback(
    (threadId: string | null, rect?: DOMRect) => {
      if (!threadId || !rect || threadId !== activeThreadId) return;
      setThreadBubbleRect(rect);
    },
    [activeThreadId]
  );

  const syncStatus = selectedProject?.syncStatus || "idle";
  const connector = selectedProject?.connector || null;

  // Empty state - no projects yet
  if (projects.length === 0 && onboarding.completed) {
    return (
      <div className="min-h-screen bg-[var(--void)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📁</div>
          <h2 className="text-2xl font-semibold text-[var(--pearl)] mb-2">No Projects Yet</h2>
          <p className="text-sm text-[var(--smoke)] mb-6">
            Create your first project to start working with AI reviewers
          </p>
          <Button
            variant="primary"
            onClick={() => router.push("/projects/new?first=true")}
          >
            Create Your First Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--void)] flex flex-col">
      {/* Grid background */}
      {!focusMode && <div className="fixed inset-0 grid-pattern pointer-events-none" />}

      {/* Header */}
      <Header
        projectName={selectedProject?.name}
        syncStatus={syncStatus === "done" ? "ready" : (syncStatus as "idle" | "syncing")}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode(!focusMode)}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        {!focusMode && (
          <Sidebar
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={selectProject}
          />
        )}

        {/* Main workspace */}
        <main className={`flex-1 flex flex-col overflow-hidden ${focusMode ? "p-6 gap-5" : "p-4 gap-4"}`}>
          {/* Editor — always shown when a project is selected */}
          {selectedProject && (
            <Editor
              onCmdK={focusCommandInput}
              disabled={false}
              annotations={editorAnnotations}
              commentThreads={selectedProject.commentThreads || []}
              activeAnnotationId={review.activeAnnotationId}
              activeThreadId={selectedProject.activeThreadId || null}
              onAnnotationClick={handleAnnotationClick}
              onAnnotationHover={handleAnnotationHover}
              onThreadClick={handleThreadClick}
              onThreadHover={handleThreadHover}
              editorRef={handleEditorRef}
            />
          )}

          {/* Prompt composer */}
          {selectedProject && (
            <div className="flex-shrink-0">
              <CommandPanel
                mode="inline"
                isOpen={true}
                onClose={() => {}}
                onRun={handleRunCommand}
                isRunning={isRunning}
                project={selectedProject}
                doers={selectedProject.doers}
                reviewers={selectedProject.reviewers}
              />
            </div>
          )}
        </main>

        {/* Right panel */}
        {!focusMode && (
        <RightPanel
          syncStatus={syncStatus === "done" ? "done" : syncStatus === "syncing" ? "syncing" : "idle"}
          connector={connector}
          filesCount={selectedProject?.files?.length || 0}
          crewDoers={selectedProject?.doers || []}
          crewReviewers={selectedProject?.reviewers || []}
            isReviewing={review.isReviewing}
            reviewResults={review.results}
            reviewSummary={review.summary}
            activeAnnotationId={review.activeAnnotationId}
            visibleJudgeIds={review.visibleJudgeIds}
            onRunReview={handleRunReview}
            onClearReview={handleClearReview}
          onRunSingleReview={handleRunSingleReview}
          runningJudgeId={review.runningJudgeId}
          onAnnotationClick={handleAnnotationClick}
          onToggleJudgeVisibility={toggleJudgeVisibility}
          decisionLog={selectedProject?.decisionLog || []}
          escalation={selectedProject?.escalation || null}
          capacity={selectedProject?.capacity || null}
          lastCommandTrace={selectedProject?.lastCommandTrace || null}
          commentThreads={selectedProject?.commentThreads || []}
          activeThreadId={selectedProject?.activeThreadId || null}
          onSelectThread={selectThread}
          onAcceptThreadSuggestion={handleAcceptThreadSuggestion}
          onRejectThreadSuggestion={handleRejectThreadSuggestion}
          onRevertThreadSuggestion={handleRevertThreadSuggestion}
          onResolveThread={handleResolveThread}
        />
      )}
      </div>

      {/* Welcome modal for first-time users */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setOnboarding({ welcome_dismissed: true })}
        projectName={selectedProject?.name}
      />

      {/* File search modal (Cmd+I) */}
      {selectedProject && (
        <FileSearch
          isOpen={showFileSearch}
          onClose={() => setShowFileSearch(false)}
          files={selectedProject.files || []}
          projectId={selectedProject.id}
          onFileSelect={(filename, content) => {
            console.log("Selected file:", filename);
            console.log("Content preview:", content?.slice(0, 100));
          }}
        />
      )}

      <ThreadBubble
        thread={activeThread}
        rect={threadBubbleRect}
        onClose={closeActiveThread}
        onAccept={handleAcceptThreadSuggestion}
        onReject={handleRejectThreadSuggestion}
        onRevert={handleRevertThreadSuggestion}
        onResolve={handleResolveThread}
      />

      {/* Annotation tooltip */}
      {tooltipData && tooltip && (
        <AnnotationTooltip
          annotation={tooltipData.annotation}
          judgeName={tooltipData.judgeName}
          color={tooltipData.color}
          rect={tooltip.rect}
        />
      )}
    </div>
  );
}
