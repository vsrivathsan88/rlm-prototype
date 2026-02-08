"use client";

import { useState, useMemo } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { KeyboardShortcut } from "@/components/ui/KeyboardShortcut";
import { notify } from "@/components/ui/NotificationCenter";
import { type Doer, type Project, type Reviewer } from "@/lib/store";
import { getPersonalizedSuggestions } from "@/lib/suggestions";
import { normalizeMentionToken, toDisplayNameMention } from "@/lib/mentions";
import {
  compilePromptEnhancer,
  generatePromptEnhancer,
  type PromptEnhancerRewritePlan,
  type PromptEnhancerUIBlock,
} from "@/lib/api";

interface CommandPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRun: (prompt: string, model: string) => void;
  isRunning: boolean;
  project?: Project;
  doers?: Doer[];
  reviewers?: Reviewer[];
  mode?: "modal" | "inline";
}

const models = [
  { id: "auto", name: "Auto", description: "Recommended" },
  { id: "moonshotai/kimi-k2-instruct-0905", name: "Kimi K2.5", description: "Reasoning + Draft" },
  { id: "qwen/qwen3-32b", name: "Qwen 32B", description: "Fast Draft" },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", description: "Heavy Reasoning" },
];

const qualityPresets = [
  { id: "good", label: "Good", instruction: "Keep this concise and useful." },
  { id: "better", label: "Better", instruction: "Include clear steps, assumptions, and risks." },
  { id: "best", label: "Best", instruction: "Be thorough, source-aware, and decision-ready with tradeoffs." },
] as const;

type QualityPreset = (typeof qualityPresets)[number]["id"];

const FALLBACK_OTHER_BLOCK: PromptEnhancerUIBlock = {
  id: "other_context",
  label: "Other Context",
  type: "textarea",
  required: false,
  placeholder: "Anything else the AI should know...",
  help_text: "Optional constraints, edge cases, or context not covered above.",
  default: "",
};

function ensureOtherBlock(blocks: PromptEnhancerUIBlock[]): PromptEnhancerUIBlock[] {
  if (blocks.some((block) => block.id === "other_context")) return blocks;
  return [...blocks, FALLBACK_OTHER_BLOCK];
}

function defaultValueForBlock(block: PromptEnhancerUIBlock): unknown {
  if (block.default !== undefined && block.default !== null) return block.default;
  if (block.type === "multi_select") return [];
  if (block.type === "checkbox") return false;
  if (block.type === "number") return "";
  return "";
}

function isMissingRequiredValue(block: PromptEnhancerUIBlock, value: unknown): boolean {
  if (!block.required) return false;
  if (block.type === "checkbox") return value !== true;
  if (block.type === "multi_select") return !Array.isArray(value) || value.length === 0;
  const text = String(value ?? "").trim();
  return !text;
}

export function CommandPanel({
  isOpen,
  onClose,
  onRun,
  isRunning,
  project,
  doers = [],
  reviewers = [],
  mode = "modal",
}: CommandPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("auto");
  const [isEnhancerOpen, setIsEnhancerOpen] = useState(false);
  const [isEnhancerLoading, setIsEnhancerLoading] = useState(false);
  const [isEnhancerApplying, setIsEnhancerApplying] = useState(false);
  const [enhancerError, setEnhancerError] = useState<string | null>(null);
  const [enhancerBlocks, setEnhancerBlocks] = useState<PromptEnhancerUIBlock[]>([]);
  const [enhancerValues, setEnhancerValues] = useState<Record<string, unknown>>({});
  const [enhancerMode, setEnhancerMode] = useState<"assist" | "auto">("assist");
  const [enhancerRewritePlan, setEnhancerRewritePlan] = useState<PromptEnhancerRewritePlan | undefined>(undefined);
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>("better");
  const [autoCoachEnabled, setAutoCoachEnabled] = useState(true);
  const isInline = mode === "inline";

  // Generate personalized suggestions based on project context
  const suggestions = useMemo(() => getPersonalizedSuggestions(project), [project]);
  const mentionables = useMemo(() => {
    const doerMentions = doers
      .filter((d) => d.enabled)
      .map((d) => ({
        id: d.id,
        label: d.name,
        alias: normalizeMentionToken(d.name),
        type: "doer" as const,
      }));
    const reviewerMentions = reviewers
      .filter((r) => r.enabled)
      .map((r) => ({
        id: r.id,
        label: r.name,
        alias: normalizeMentionToken(r.name),
        type: "reviewer" as const,
      }));
    return [...doerMentions, ...reviewerMentions];
  }, [doers, reviewers]);
  const mentionOptions = useMemo(() => {
    return mentionables.flatMap((m) => {
      const options: Array<{
        key: string;
        token: string;
        usesBraces: boolean;
        type: "doer" | "reviewer";
        label: string;
        hint: string;
      }> = [
        {
          key: `${m.type}-${m.id}-id`,
          token: m.id,
          usesBraces: false,
          type: m.type,
          label: `@${m.id}`,
          hint: `${m.label} (${m.type})`,
        },
      ];
      if (m.alias && m.alias !== m.id) {
        options.push({
          key: `${m.type}-${m.id}-alias`,
          token: m.alias,
          usesBraces: false,
          type: m.type,
          label: `@${m.alias}`,
          hint: `${m.label} name alias`,
        });
      }
      options.push({
        key: `${m.type}-${m.id}-display`,
        token: m.label,
        usesBraces: true,
        type: m.type,
        label: toDisplayNameMention(m.label),
        hint: `${m.label} display name`,
      });
      return options;
    });
  }, [mentionables]);
  const tokenQueryMatch = prompt.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
  const nameQueryMatch = prompt.match(/(?:^|\s)@\{([^}]*)$/);
  const mentionMode: "token" | "name" | null = nameQueryMatch
    ? "name"
    : tokenQueryMatch
      ? "token"
      : null;
  const mentionQuery = (nameQueryMatch?.[1] ?? tokenQueryMatch?.[1] ?? "").trim().toLowerCase();
  const mentionSuggestions =
    mentionMode === null
      ? []
      : mentionOptions.filter((option) => {
          if (mentionMode === "name" && !option.usesBraces) return false;
          if (mentionMode === "token" && option.usesBraces) return false;
          const haystack = `${option.token} ${option.hint}`.toLowerCase();
          return haystack.includes(mentionQuery);
        });

  if (!isInline && !isOpen) return null;

  const applyPromptCoach = (value: string): string => {
    let next = value.trim();
    const qualityInstruction =
      qualityPresets.find((preset) => preset.id === qualityPreset)?.instruction ??
      qualityPresets[1].instruction;
    next = `${next}\n\nOutput Quality Target: ${qualityInstruction}`;

    if (autoCoachEnabled && next.length < 240) {
      next = `${next}\n\nStructure your response as: Objective, Plan, Assumptions, Risks, and Next Actions.`;
    }
    return next;
  };

  const handleRun = () => {
    if (prompt.trim()) {
      const coached = applyPromptCoach(prompt);
      onRun(coached, selectedModel);
      setPrompt("");
    }
  };

  const insertMention = (token: string, usesBraces: boolean) => {
    const rendered = usesBraces ? `@{${token}}` : `@${token}`;
    if (mentionMode === "name") {
      setPrompt((prev) => prev.replace(/(?:^|\s)@\{[^}]*$/, ` ${rendered} `));
      return;
    }
    if (mentionMode === "token") {
      setPrompt((prev) => prev.replace(/(?:^|\s)@[a-zA-Z0-9_-]*$/, ` ${rendered} `));
      return;
    }
    const withSpace = prompt && !prompt.endsWith(" ") ? `${prompt} ` : prompt;
      setPrompt(`${withSpace}${rendered} `);
  };

  const handleOpenEnhancer = async () => {
    if (!project?.id) {
      notify.warning("No Project Selected", "Select a project before using prompt enhancement.");
      return;
    }
    const trimmed = prompt.trim();
    if (!trimmed) {
      notify.warning("Add a Prompt First", "Write a rough prompt, then click Enhance Prompt.");
      return;
    }

    setIsEnhancerOpen(true);
    setIsEnhancerLoading(true);
    setEnhancerError(null);
    try {
      const generated = await generatePromptEnhancer(project.id, {
        prompt: trimmed,
        model: "qwen/qwen3-32b",
        project_name: project.name,
        project_goal: project.goal ?? undefined,
        target_audience: project.target_audience,
        doers: (doers || []).map((doer) => ({
          id: doer.id,
          name: doer.name,
          specialty: doer.specialty,
          description: doer.description,
        })),
        reviewers: (reviewers || []).map((reviewer) => ({
          id: reviewer.id,
          name: reviewer.name,
          description: reviewer.description,
          reason: reviewer.reason,
        })),
      });
      const blocks = ensureOtherBlock(generated.ui_blocks || []);
      const initialValues: Record<string, unknown> = {};
      for (const block of blocks) {
        initialValues[block.id] = defaultValueForBlock(block);
      }
      setEnhancerBlocks(blocks);
      setEnhancerValues(initialValues);
      setEnhancerRewritePlan(generated.rewrite_plan);
    } catch (error) {
      setEnhancerError(error instanceof Error ? error.message : "Prompt enhancement failed");
      setEnhancerBlocks(ensureOtherBlock([FALLBACK_OTHER_BLOCK]));
      setEnhancerValues({ other_context: "" });
    } finally {
      setIsEnhancerLoading(false);
    }
  };

  const handleEnhancerValueChange = (block: PromptEnhancerUIBlock, value: unknown) => {
    setEnhancerValues((prev) => ({ ...prev, [block.id]: value }));
  };

  const handleApplyEnhancer = async () => {
    if (!project?.id) return;
    const trimmed = prompt.trim();
    if (!trimmed) {
      notify.warning("No Prompt", "Write a prompt before applying enhancements.");
      return;
    }
    for (const block of enhancerBlocks) {
      if (isMissingRequiredValue(block, enhancerValues[block.id])) {
        notify.warning("Missing Required Field", `Please fill: ${block.label}`);
        return;
      }
    }

    setIsEnhancerApplying(true);
    try {
      const compiled = await compilePromptEnhancer(project.id, {
        prompt: trimmed,
        mode: enhancerMode,
        answers: enhancerValues,
        ui_blocks: enhancerBlocks,
        rewrite_plan: enhancerRewritePlan,
      });
      setPrompt(compiled.enhanced_prompt);
      setIsEnhancerOpen(false);
      notify.success(
        "Prompt Enhanced",
        compiled.applied_fields.length
          ? `Added context from ${compiled.applied_fields.length} fields.`
          : "Prompt normalized with your extra context."
      );
    } catch (error) {
      notify.error(
        "Enhancement Failed",
        error instanceof Error ? error.message : "Could not enhance prompt"
      );
    } finally {
      setIsEnhancerApplying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      handleRun();
    }
    if (!isInline && e.key === "Escape") {
      onClose();
    }
  };

  const handleQuickReviewerAction = (mode: "facts" | "clarity" | "exec") => {
    if (isRunning) return;
    const fallbackReviewer = reviewers.find((reviewer) => reviewer.enabled);
    const factReviewer =
      reviewers.find(
        (reviewer) =>
          reviewer.enabled &&
          /(fact|integrity|evidence|source)/i.test(`${reviewer.id} ${reviewer.name} ${reviewer.reason}`)
      ) || fallbackReviewer;
    const clarityReviewer =
      reviewers.find(
        (reviewer) =>
          reviewer.enabled &&
          /(clarity|structure|readability|tone)/i.test(`${reviewer.id} ${reviewer.name} ${reviewer.reason}`)
      ) || fallbackReviewer;
    const execReviewer =
      reviewers.find(
        (reviewer) =>
          reviewer.enabled &&
          /(executive|risk|decision|strategy)/i.test(`${reviewer.id} ${reviewer.name} ${reviewer.reason}`)
      ) || fallbackReviewer;

    const target =
      mode === "facts" ? factReviewer : mode === "clarity" ? clarityReviewer : execReviewer;
    if (!target) {
      notify.warning("No Reviewer Available", "Enable at least one reviewer to run quick checks.");
      return;
    }

    const baseInstruction =
      mode === "facts"
        ? "Check this draft for unsupported claims and missing evidence."
        : mode === "clarity"
          ? "Rewrite this draft for clarity, flow, and readability."
          : "Make this draft executive-ready with key decisions and risks.";
    const quickPrompt = `@${target.id} ${baseInstruction}`;
    onRun(applyPromptCoach(quickPrompt), selectedModel);
  };

  const panelContent = (
    <Panel
      header={
        <PanelHeader
          title="Command"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          }
          action={
            !isInline ? (
                <button
                  onClick={onClose}
                  className="text-[var(--smoke)] hover:text-[var(--pearl)] transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )
              : null
          }
        />
      }
      noPadding
    >
      <div className="p-4 space-y-4">
        {/* Model selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">
            Model
          </span>
          <div className="flex gap-1">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`
                  px-3 py-1.5 text-xs transition-all
                  ${selectedModel === model.id
                    ? "bg-[var(--phosphor-glow)] text-[var(--phosphor)] border border-[var(--phosphor)]/30"
                    : "bg-[var(--graphite)] text-[var(--silver)] border border-[var(--zinc)] hover:border-[var(--ash)]"
                  }
                `}
              >
                {model.name}
                {model.id === "auto" && (
                  <span className="ml-1.5 text-[10px] opacity-60">•</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt input */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask for a summary, rewrite, evidence check... (tag @id, @name_alias, or @{Display Name})"
            className="
              w-full h-28 p-4
              bg-[var(--graphite)] border border-[var(--zinc)]
              text-[var(--pearl)] text-sm font-mono
              placeholder:text-[var(--ash)]
              resize-none
              focus:outline-none focus:border-[var(--phosphor)]/50 focus:ring-1 focus:ring-[var(--phosphor)]/20
              transition-all
            "
            autoFocus={!isInline}
            data-testid="command-input"
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[10px] text-[var(--ash)]">
            <KeyboardShortcut keys={["⌘", "↵"]} />
            <span>to run</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">
              Quality
            </span>
            <div className="flex gap-1">
              {qualityPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setQualityPreset(preset.id)}
                  className={`px-2 py-1 text-[10px] border ${
                    qualityPreset === preset.id
                      ? "border-[var(--phosphor)]/40 text-[var(--phosphor)] bg-[var(--phosphor-glow)]"
                      : "border-[var(--zinc)] text-[var(--smoke)] bg-[var(--graphite)] hover:text-[var(--pearl)]"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label className="ml-auto inline-flex items-center gap-1 text-[10px] text-[var(--ash)]">
              <input
                type="checkbox"
                checked={autoCoachEnabled}
                onChange={(e) => setAutoCoachEnabled(e.target.checked)}
              />
              Prompt Coach
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickReviewerAction("facts")}
              className="px-2 py-1 text-[10px] border border-[var(--zinc)] bg-[var(--graphite)] text-[var(--smoke)] hover:text-[var(--pearl)]"
            >
              Check Facts
            </button>
            <button
              type="button"
              onClick={() => handleQuickReviewerAction("clarity")}
              className="px-2 py-1 text-[10px] border border-[var(--zinc)] bg-[var(--graphite)] text-[var(--smoke)] hover:text-[var(--pearl)]"
            >
              Make Clearer
            </button>
            <button
              type="button"
              onClick={() => handleQuickReviewerAction("exec")}
              className="px-2 py-1 text-[10px] border border-[var(--zinc)] bg-[var(--graphite)] text-[var(--smoke)] hover:text-[var(--pearl)]"
            >
              Exec-Ready
            </button>
          </div>
        </div>

        {mentionMode && mentionSuggestions.length > 0 && (
          <div className="rounded border border-[var(--zinc)] bg-[var(--graphite)] p-2">
            <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">
              Mention Suggestions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {mentionSuggestions.slice(0, 10).map((m) => (
                <button
                  key={m.key}
                  onClick={() => insertMention(m.token, m.usesBraces)}
                  className="px-2 py-1 text-xs bg-[var(--carbon)] border border-[var(--zinc)] hover:border-[var(--ash)] text-[var(--pearl)]"
                  title={m.hint}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isInline && mentionables.length > 0 && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)] block mb-2">
              Doers (Builders) & Reviewers (Critics)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {mentionOptions.slice(0, 12).map((m) => (
                <button
                  key={m.key}
                  onClick={() => insertMention(m.token, m.usesBraces)}
                  className="px-2 py-1 text-xs bg-[var(--graphite)] border border-[var(--zinc)] text-[var(--silver)] hover:text-[var(--pearl)] hover:border-[var(--ash)] transition-colors"
                  title={`Mention ${m.hint}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-[var(--ash)]">
              Tip: `@id` is fastest, `@name_alias` feels natural, and `@&#123;Display Name&#125;` works with spaces.
            </p>
          </div>
        )}

        {!isInline && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)] block mb-2">
              {project ? "Personalized for Your Project" : "Suggestions"}
            </span>
            <div className="grid grid-cols-1 gap-2">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(suggestion)}
                  className={`
                    text-left px-3 py-2.5 text-xs leading-relaxed
                    bg-[var(--graphite)] border border-[var(--zinc)]
                    text-[var(--silver)]
                    hover:border-[var(--ash)] hover:text-[var(--pearl)] hover:bg-[var(--slate)]
                    transition-all
                    animate-fade-in-up stagger-${Math.min(i + 1, 4)}
                  `}
                  title="Click to insert this prompt"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)]">
          <div className="text-[10px] font-mono text-[var(--ash)]">
            {isRunning && (
              <span className="flex items-center gap-2">
                <span className="status-dot status-dot-syncing" />
                Processing with RLM...
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {!isInline && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenEnhancer}
              disabled={!prompt.trim() || isRunning || isEnhancerLoading}
              isLoading={isEnhancerLoading}
              data-testid="prompt-enhance-btn"
            >
              {isEnhancerLoading ? "Enhancing..." : "Enhance Prompt"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRun}
              disabled={!prompt.trim() || isRunning}
              isLoading={isRunning}
            >
              {isRunning ? "Running..." : "Run"}
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );

  const enhancerModal = isEnhancerOpen ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--void)]/80 backdrop-blur-sm"
        onClick={() => !isEnhancerApplying && setIsEnhancerOpen(false)}
      />
      <div className="relative w-full max-w-2xl max-h-[86vh] overflow-hidden border border-[var(--zinc)] bg-[var(--graphite)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--zinc)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--pearl)]">Enhance Prompt</h3>
            <p className="text-xs text-[var(--smoke)]">
              Quick parameters for a stronger, more specific prompt. Includes free-text Other.
            </p>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setEnhancerMode("assist")}
              className={`px-2.5 py-1 text-[11px] border ${
                enhancerMode === "assist"
                  ? "border-[var(--phosphor)] text-[var(--phosphor)] bg-[var(--phosphor-glow)]"
                  : "border-[var(--zinc)] text-[var(--silver)] bg-[var(--carbon)]"
              }`}
            >
              Assist
            </button>
            <button
              type="button"
              onClick={() => setEnhancerMode("auto")}
              className={`px-2.5 py-1 text-[11px] border ${
                enhancerMode === "auto"
                  ? "border-[var(--phosphor)] text-[var(--phosphor)] bg-[var(--phosphor-glow)]"
                  : "border-[var(--zinc)] text-[var(--silver)] bg-[var(--carbon)]"
              }`}
            >
              Auto
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[64vh]">
          {isEnhancerLoading && (
            <div className="text-xs text-[var(--silver)]" data-testid="prompt-enhancer-loading">
              Generating quick intake fields with Qwen 32B...
            </div>
          )}

          {!isEnhancerLoading && enhancerError && (
            <div className="text-xs text-amber-300 border border-amber-400/30 bg-amber-500/10 p-3">
              {enhancerError}. Showing fallback fields.
            </div>
          )}

          {!isEnhancerLoading &&
            enhancerBlocks.map((block) => {
              const currentValue = enhancerValues[block.id];
              const options = block.options || [];
              return (
                <div key={block.id} className="space-y-1.5" data-testid={`enhancer-field-${block.id}`}>
                  <label className="block text-xs font-mono uppercase tracking-wide text-[var(--smoke)]">
                    {block.label}
                    {block.required ? " *" : ""}
                  </label>

                  {block.type === "textarea" && (
                    <textarea
                      value={String(currentValue ?? "")}
                      onChange={(e) => handleEnhancerValueChange(block, e.target.value)}
                      placeholder={block.placeholder ?? ""}
                      className="w-full min-h-[90px] p-3 text-sm bg-[var(--carbon)] border border-[var(--zinc)] text-[var(--pearl)] placeholder:text-[var(--ash)] focus:outline-none focus:border-[var(--phosphor)]/50"
                    />
                  )}

                  {block.type === "select" && (
                    <select
                      value={String(currentValue ?? "")}
                      onChange={(e) => handleEnhancerValueChange(block, e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-[var(--carbon)] border border-[var(--zinc)] text-[var(--pearl)] focus:outline-none focus:border-[var(--phosphor)]/50"
                    >
                      <option value="">Select an option</option>
                      {options.map((option) => (
                        <option key={`${block.id}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {block.type === "multi_select" && (
                    <div className="flex flex-wrap gap-2">
                      {options.map((option) => {
                        const selectedValues = Array.isArray(currentValue)
                          ? currentValue.map((item) => String(item))
                          : [];
                        const active = selectedValues.includes(option.value);
                        return (
                          <button
                            key={`${block.id}-${option.value}`}
                            type="button"
                            onClick={() => {
                              const next = active
                                ? selectedValues.filter((item) => item !== option.value)
                                : [...selectedValues, option.value];
                              handleEnhancerValueChange(block, next);
                            }}
                            className={`px-2.5 py-1 text-xs border ${
                              active
                                ? "border-[var(--phosphor)] text-[var(--phosphor)] bg-[var(--phosphor-glow)]"
                                : "border-[var(--zinc)] text-[var(--silver)] bg-[var(--carbon)]"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {block.type === "checkbox" && (
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--silver)]">
                      <input
                        type="checkbox"
                        checked={Boolean(currentValue)}
                        onChange={(e) => handleEnhancerValueChange(block, e.target.checked)}
                      />
                      Yes
                    </label>
                  )}

                  {(block.type === "text" || block.type === "number" || block.type === "date") && (
                    <input
                      type={block.type === "number" ? "number" : block.type === "date" ? "date" : "text"}
                      value={String(currentValue ?? "")}
                      onChange={(e) => handleEnhancerValueChange(block, e.target.value)}
                      placeholder={block.placeholder ?? ""}
                      className="w-full h-10 px-3 text-sm bg-[var(--carbon)] border border-[var(--zinc)] text-[var(--pearl)] placeholder:text-[var(--ash)] focus:outline-none focus:border-[var(--phosphor)]/50"
                    />
                  )}

                  {block.help_text && (
                    <p className="text-[11px] text-[var(--ash)]">{block.help_text}</p>
                  )}
                </div>
              );
            })}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--zinc)]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEnhancerOpen(false)}
            disabled={isEnhancerApplying}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApplyEnhancer}
            isLoading={isEnhancerApplying}
            disabled={isEnhancerLoading || isEnhancerApplying}
            data-testid="prompt-enhancer-apply"
          >
            {isEnhancerApplying ? "Applying..." : "Apply Enhancement"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  if (isInline) {
    return (
      <>
        {panelContent}
        {enhancerModal}
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-[var(--void)]/80 backdrop-blur-sm animate-fade-in-up"
          onClick={onClose}
        />

        {/* Panel */}
        <div className="relative w-full max-w-2xl mx-4 animate-scale-in">
          {panelContent}
        </div>
      </div>
      {enhancerModal}
    </>
  );
}
