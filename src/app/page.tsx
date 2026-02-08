"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, type Project } from "@/lib/store";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Editor } from "@/components/workspace/Editor";
import { CommandPanel } from "@/components/workspace/CommandPanel";
import { RightPanel } from "@/components/workspace/RightPanel";
import { RolloutHistoryModal } from "@/components/workspace/RolloutHistoryModal";
import { WelcomeModal } from "@/components/workspace/WelcomeModal";
import { FileSearch } from "@/components/workspace/FileSearch";
import { AnnotationTooltip } from "@/components/workspace/AnnotationTooltip";
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
import {
  execProjectRepl,
  getCrewVersions,
  getProjectRolloutHistory,
  reviewDocumentShadow,
  setProjectRolloutMode,
  streamProjectSync,
  type BackendLlmRouteEvent,
} from "@/lib/api";

function promoteStrictness(
  strictness: "low" | "medium" | "high" | undefined
): "low" | "medium" | "high" {
  if (strictness === "low") return "medium";
  if (strictness === "medium") return "high";
  return "high";
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
  const fallbackAlertRef = useRef<Record<string, string>>({});
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

  // Phase 3 legacy-safe migration: existing projects without rollout mode remain baseline.
  useEffect(() => {
    const legacyProjects = projects.filter((project) => !project.rolloutMode);
    if (!legacyProjects.length) return;
    for (const project of legacyProjects) {
      updateProject(project.id, { rolloutMode: "baseline" });
    }
  }, [projects, updateProject]);

  const [isRunning, setIsRunning] = useState(false);

  // File search state
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [showRolloutHistory, setShowRolloutHistory] = useState(false);
  const [isRecoveringToActive, setIsRecoveringToActive] = useState(false);

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
    if (externalActionPattern.test(cleanPrompt) && typeof window !== "undefined") {
      const confirmed = window.confirm(
        "This request may trigger an external action. Continue?"
      );
      if (!confirmed) {
        notify.info("Action Cancelled", "External action requires explicit confirmation.");
        return;
      }
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
      for (const event of response.llm_meta || []) {
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

      const output = (response.stdout || "").trim();
      if (output) {
        const editor = editorRef.current;
        if (editor) {
          editor.chain().focus().insertContent(`\n\n${output}`).run();
          notify.success("Command Complete", "Inserted output into the editor.");
        } else {
          notify.success("Command Complete", output.slice(0, 220));
        }
      } else {
        notify.info("Command Complete", "No output returned.");
      }

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

      setIsRunning(false);
    } catch (error) {
      setIsRunning(false);
      notify.error(
        "Command Failed",
        error instanceof Error ? error.message : "Failed to run command in REPL"
      );
    }
  }, [addHubEvent, addLlmTelemetryEvent, selectedProject]);

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

  const refreshRolloutHistory = useCallback(
    async (projectId: string) => {
      try {
        const history = await getProjectRolloutHistory(projectId);
        updateProject(projectId, { rolloutHistory: history.events });
      } catch (err) {
        console.warn("Failed to fetch rollout history", err);
      }
    },
    [updateProject]
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
    void refreshRolloutHistory(selectedProject.id);
  }, [selectedProject?.id, refreshRolloutHistory]);

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

  useEffect(() => {
    if (!selectedProject?.id || !selectedProject.rolloutHistory?.length) return;
    const latestEvent =
      selectedProject.rolloutHistory[selectedProject.rolloutHistory.length - 1];
    if (latestEvent.source !== "auto_fallback") return;
    if (fallbackAlertRef.current[selectedProject.id] === latestEvent.updated_at) return;
    fallbackAlertRef.current[selectedProject.id] = latestEvent.updated_at;
    notify.warning(
      "Rollout Auto-Fallback",
      "Reviewer pipeline switched to shadow mode after an active-path failure."
    );
  }, [selectedProject?.id, selectedProject?.rolloutHistory]);

  // --- Review handlers ---

  const handleRunReview = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || !selectedProject) return;

    // Get judge IDs from project reviewers, or use defaults
    const judgeIds = selectedProject.reviewers
      ?.filter((r) => r.enabled)
      .map((r) => r.id) ?? ["brand_consistency", "legal_compliance"];

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
      pushLlmMetaEvents(llmMeta);

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
      notify.error("Review Failed", err instanceof Error ? err.message : "Is the backend running?");
    } finally {
      void refreshRolloutHistory(selectedProject.id);
    }
  }, [
    selectedProject,
    startReview,
    setReviewResults,
    clearReview,
    addHubEvent,
    getProfileContext,
    pushLlmMetaEvents,
    refreshRolloutHistory,
  ]);

  const handleRunSingleReview = useCallback(
    async (judgeId: string) => {
      const editor = editorRef.current;
      if (!editor || !selectedProject) return;

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
        }
      } catch (err) {
        console.error("Single reviewer run failed:", err);
        setRunningJudgeId(null);
        notify.error("Review Failed", err instanceof Error ? err.message : "Is the backend running?");
      } finally {
        void refreshRolloutHistory(selectedProject.id);
      }
    },
    [
      selectedProject,
      setRunningJudgeId,
      updateSingleResult,
      addHubEvent,
      getProfileContext,
      pushLlmMetaEvents,
      refreshRolloutHistory,
    ]
  );

  const handleRunShadowReview = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || !selectedProject) return;

    const judgeIds = selectedProject.reviewers
      ?.filter((r) => r.enabled)
      .map((r) => r.id) ?? ["brand_consistency", "legal_compliance"];
    const baselineReviewerContext = selectedProject.reviewers?.map((reviewer) => ({
      id: reviewer.id,
      name: reviewer.name,
      description: reviewer.description ?? reviewer.reason,
      system_prompt: reviewer.system_prompt,
      strictness: reviewer.strictness,
      rubric: reviewer.rubric,
    }));
    const candidateReviewerContext = selectedProject.reviewers?.map((reviewer) => ({
      id: reviewer.id,
      name: reviewer.name,
      description: reviewer.description ?? reviewer.reason,
      system_prompt: reviewer.system_prompt
        ? `${reviewer.system_prompt}\n\nAdditional candidate instruction: prioritize strict source-backed critique and higher issue sensitivity.`
        : "Apply stricter source-backed critique with higher issue sensitivity.",
      strictness: promoteStrictness(reviewer.strictness),
      rubric: reviewer.rubric,
    }));

    updateProject(selectedProject.id, {
      shadowReview: {
        status: "running",
      },
    });

    try {
      const response = await reviewDocumentShadow({
        document_text: editor.getText(),
        judge_ids: judgeIds,
        project_id: selectedProject.id,
        profile_context: getProfileContext(),
        reviewer_context: baselineReviewerContext,
        candidate_judge_ids: judgeIds,
        candidate_reviewer_context: candidateReviewerContext,
      });
      pushLlmMetaEvents(response.baseline.llm_meta || []);
      pushLlmMetaEvents(response.candidate.llm_meta || []);

      updateProject(selectedProject.id, {
        shadowReview: {
          status: "done",
          last_run_at: new Date().toISOString(),
          pair_count: response.comparison.pair_count,
          decision_agreement_rate: response.comparison.decision_agreement_rate,
          precision_proxy: response.comparison.precision_proxy,
          recall_proxy: response.comparison.recall_proxy,
          mean_score_delta: response.comparison.mean_score_delta,
        },
      });
      notify.info(
        "Shadow Review Complete",
        `Agreement ${Math.round(response.comparison.decision_agreement_rate * 100)}% across ${response.comparison.pair_count} reviewer pairs`
      );
    } catch (err) {
      updateProject(selectedProject.id, {
        shadowReview: {
          status: "error",
          error: err instanceof Error ? err.message : "Shadow review failed",
        },
      });
      notify.error(
        "Shadow Review Failed",
        err instanceof Error ? err.message : "Is the backend running?"
      );
    }
  }, [selectedProject, updateProject, getProfileContext, pushLlmMetaEvents]);

  const handleSetRolloutMode = useCallback(
    async (mode: "baseline" | "shadow" | "active") => {
      if (!selectedProject) return;
      const previous = selectedProject.rolloutMode || "baseline";

      updateProject(selectedProject.id, { rolloutMode: mode });
      try {
        await setProjectRolloutMode(
          selectedProject.id,
          mode,
          mode === "baseline" ? "manual rollback" : "controlled launch update"
        );
        await refreshRolloutHistory(selectedProject.id);
        notify.success("Rollout Mode Updated", `Project now running in ${mode} mode.`);
      } catch (err) {
        updateProject(selectedProject.id, { rolloutMode: previous });
        notify.error(
          "Rollout Update Failed",
          err instanceof Error ? err.message : "Could not update rollout mode"
        );
      }
    },
    [selectedProject, updateProject, refreshRolloutHistory]
  );

  const handleRecoverToActive = useCallback(async () => {
    if (!selectedProject) return;
    const previous = selectedProject.rolloutMode || "baseline";
    setIsRecoveringToActive(true);
    updateProject(selectedProject.id, { rolloutMode: "active" });
    try {
      await setProjectRolloutMode(
        selectedProject.id,
        "active",
        "guided recovery after fallback"
      );
      await refreshRolloutHistory(selectedProject.id);
      notify.success(
        "Recovery Complete",
        "Project returned to active rollout mode. Monitor next review runs closely."
      );
    } catch (err) {
      updateProject(selectedProject.id, { rolloutMode: previous });
      notify.error(
        "Recovery Failed",
        err instanceof Error ? err.message : "Could not recover to active mode"
      );
    } finally {
      setIsRecoveringToActive(false);
    }
  }, [selectedProject, refreshRolloutHistory, updateProject]);

  const handleAnnotationClick = useCallback(
    (annotationId: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      // Find the annotation
      const ann = review.results
        .flatMap((r) => r.annotations)
        .find((a) => a.id === annotationId);

      if (ann?.startPos != null) {
        // Scroll editor to annotation
        editor.commands.focus();
        editor.commands.setTextSelection(ann.startPos);

        // Highlight for 2 seconds
        setActiveAnnotation(annotationId);
        setTimeout(() => setActiveAnnotation(null), 2000);
      }
    },
    [review.results, setActiveAnnotation]
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
              activeAnnotationId={review.activeAnnotationId}
              onAnnotationClick={handleAnnotationClick}
              onAnnotationHover={handleAnnotationHover}
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
            onClearReview={clearReview}
          onRunSingleReview={handleRunSingleReview}
          runningJudgeId={review.runningJudgeId}
          onAnnotationClick={handleAnnotationClick}
          onToggleJudgeVisibility={toggleJudgeVisibility}
          shadowReview={selectedProject?.shadowReview}
          onRunShadowReview={handleRunShadowReview}
          rolloutMode={selectedProject?.rolloutMode || "baseline"}
          rolloutHistory={selectedProject?.rolloutHistory}
          onOpenRolloutHistory={() => setShowRolloutHistory(true)}
          onRecoverToActive={handleRecoverToActive}
          isRecoveringToActive={isRecoveringToActive}
          onSetRolloutMode={handleSetRolloutMode}
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

      {/* Rollout history and guided recovery */}
      {selectedProject && (
        <RolloutHistoryModal
          isOpen={showRolloutHistory}
          onClose={() => setShowRolloutHistory(false)}
          projectName={selectedProject.name}
          currentMode={selectedProject.rolloutMode || "baseline"}
          events={selectedProject.rolloutHistory || []}
          onRecoverToActive={handleRecoverToActive}
          isRecovering={isRecoveringToActive}
        />
      )}

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
