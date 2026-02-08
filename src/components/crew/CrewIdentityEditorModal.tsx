"use client";

import { useEffect, useMemo, useState } from "react";
import type { Doer, Reviewer } from "@/lib/store";

type CrewKind = "doer" | "reviewer";

interface CrewIdentityEditorModalProps {
  isOpen: boolean;
  kind: CrewKind;
  member: Doer | Reviewer | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (updated: Doer | Reviewer) => void | Promise<void>;
}

type DraftState = {
  id: string;
  name: string;
  summary: string;
  specialty: string;
  strictness: "low" | "medium" | "high";
  systemPrompt: string;
  goalsText: string;
  skillsText: string;
  toolsText: string;
  scoringScale: string;
  decisionRulesText: string;
  enabled: boolean;
};

function toLineList(values?: string[]): string {
  return (values || []).join("\n");
}

function parseLineList(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function toToolList(
  values?: Array<{ tool_name: string; tool_description: string; tool_output: string }>
): string {
  return (values || [])
    .map((tool) => `${tool.tool_name} | ${tool.tool_description} | ${tool.tool_output}`)
    .join("\n");
}

function parseToolList(
  value: string
): Array<{ tool_name: string; tool_description: string; tool_output: string }> {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length >= 3) {
        return {
          tool_name: parts[0],
          tool_description: parts[1],
          tool_output: parts.slice(2).join(" | "),
        };
      }
      if (parts.length === 2) {
        return {
          tool_name: parts[0],
          tool_description: parts[1],
          tool_output: "Structured notes",
        };
      }
      return {
        tool_name: parts[0] || "",
        tool_description: "Custom tool",
        tool_output: "Structured notes",
      };
    })
    .filter((tool) => tool.tool_name && tool.tool_description && tool.tool_output)
    .slice(0, 8);
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");
}

function buildDraft(kind: CrewKind, member: Doer | Reviewer): DraftState {
  const summary = kind === "doer" ? (member as Doer).description : (member as Reviewer).reason;
  return {
    id: member.id,
    name: member.name,
    summary: summary || "",
    specialty: kind === "doer" ? (member as Doer).specialty || "" : "",
    strictness: member.strictness || "medium",
    systemPrompt: member.system_prompt || "",
    goalsText: toLineList(member.goals_kpis),
    skillsText: toLineList(member.skills),
    toolsText: toToolList(member.tools),
    scoringScale: member.rubric?.scoring_scale || "",
    decisionRulesText: toLineList(member.rubric?.decision_rules),
    enabled: member.enabled,
  };
}

function inputClassName(): string {
  return "w-full rounded-md border border-[var(--border-medium)] bg-[var(--deck-frost-strong)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-secondary)]";
}

export function CrewIdentityEditorModal({
  isOpen,
  kind,
  member,
  isSaving = false,
  onClose,
  onSave,
}: CrewIdentityEditorModalProps) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !member) return;
    setDraft(buildDraft(kind, member));
    setError(null);
  }, [isOpen, kind, member]);

  const title = useMemo(
    () => (kind === "doer" ? "Edit Doer (Builder) Identity" : "Edit Reviewer (Critic) Identity"),
    [kind]
  );

  if (!isOpen || !member || !draft) return null;

  const handleSave = async () => {
    const id = normalizeId(draft.id);
    const name = draft.name.trim();
    const summary = draft.summary.trim();

    if (!id) {
      setError("ID cannot be empty.");
      return;
    }
    if (!name) {
      setError("Name cannot be empty.");
      return;
    }
    if (!summary) {
      setError("Description cannot be empty.");
      return;
    }

    const goals = parseLineList(draft.goalsText);
    const skills = parseLineList(draft.skillsText);
    const tools = parseToolList(draft.toolsText);
    const decisionRules = parseLineList(draft.decisionRulesText);
    const nextRubric = {
      ...(member.rubric || {}),
      scoring_scale: draft.scoringScale.trim() || undefined,
      decision_rules: decisionRules.length > 0 ? decisionRules : undefined,
    };

    try {
      if (kind === "doer") {
        const updated: Doer = {
          ...(member as Doer),
          id,
          name,
          description: summary,
          specialty: draft.specialty.trim() || undefined,
          strictness: draft.strictness,
          system_prompt: draft.systemPrompt.trim() || undefined,
          goals_kpis: goals.length > 0 ? goals : undefined,
          skills: skills.length > 0 ? skills : undefined,
          tools: tools.length > 0 ? tools : undefined,
          rubric: nextRubric,
          enabled: draft.enabled,
        };
        await onSave(updated);
      } else {
        const updated: Reviewer = {
          ...(member as Reviewer),
          id,
          name,
          reason: summary,
          description: summary,
          strictness: draft.strictness,
          system_prompt: draft.systemPrompt.trim() || undefined,
          goals_kpis: goals.length > 0 ? goals : undefined,
          skills: skills.length > 0 ? skills : undefined,
          tools: tools.length > 0 ? tools : undefined,
          rubric: nextRubric,
          enabled: draft.enabled,
        };
        await onSave(updated);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save identity.");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close identity editor"
        className="absolute inset-0 bg-[var(--deck-frost)] backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="glass-panel relative z-[71] w-full max-w-2xl rounded-2xl p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Tune role, goals, skills, and system prompts for higher signal outputs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--border-medium)] bg-[var(--deck-frost-strong)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-xs text-[var(--text-secondary)]">
            ID
            <input
              value={draft.id}
              onChange={(event) => setDraft((prev) => (prev ? { ...prev, id: event.target.value } : prev))}
              className={inputClassName()}
            />
          </label>
          <label className="text-xs text-[var(--text-secondary)]">
            Name
            <input
              data-testid="crew-identity-name-input"
              value={draft.name}
              onChange={(event) => setDraft((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
              className={inputClassName()}
            />
          </label>
        </div>

        <label className="mt-3 block text-xs text-[var(--text-secondary)]">
          {kind === "doer" ? "Doer Description" : "Reviewer Reason"}
          <textarea
            value={draft.summary}
            onChange={(event) =>
              setDraft((prev) => (prev ? { ...prev, summary: event.target.value } : prev))
            }
            rows={2}
            className={`${inputClassName()} resize-none`}
          />
        </label>

        {kind === "doer" && (
          <label className="mt-3 block text-xs text-[var(--text-secondary)]">
            Specialty
            <input
              value={draft.specialty}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, specialty: event.target.value } : prev))
              }
              className={inputClassName()}
            />
          </label>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-xs text-[var(--text-secondary)]">
            Strictness
            <select
              value={draft.strictness}
              onChange={(event) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        strictness:
                          event.target.value === "low" ||
                          event.target.value === "medium" ||
                          event.target.value === "high"
                            ? event.target.value
                            : "medium",
                      }
                    : prev
                )
              }
              className={inputClassName()}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="text-xs text-[var(--text-secondary)] md:col-span-2">
            Rubric Scoring Scale
            <input
              value={draft.scoringScale}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, scoringScale: event.target.value } : prev))
              }
              placeholder="e.g. 0-10 weighted rubric"
              className={inputClassName()}
            />
          </label>
        </div>

        <label className="mt-3 block text-xs text-[var(--text-secondary)]">
          System Prompt
          <textarea
            value={draft.systemPrompt}
            onChange={(event) =>
              setDraft((prev) => (prev ? { ...prev, systemPrompt: event.target.value } : prev))
            }
            rows={4}
            className={`${inputClassName()} resize-y`}
          />
        </label>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-xs text-[var(--text-secondary)]">
            Goals / KPIs (one per line)
            <textarea
              value={draft.goalsText}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, goalsText: event.target.value } : prev))
              }
              rows={4}
              className={`${inputClassName()} resize-y`}
            />
          </label>
          <label className="text-xs text-[var(--text-secondary)]">
            Skills (one per line)
            <textarea
              value={draft.skillsText}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, skillsText: event.target.value } : prev))
              }
              rows={4}
              className={`${inputClassName()} resize-y`}
            />
          </label>
        </div>

        <label className="mt-3 block text-xs text-[var(--text-secondary)]">
          Tools (one per line): `tool_name | tool_description | tool_output`
          <textarea
            value={draft.toolsText}
            onChange={(event) =>
              setDraft((prev) => (prev ? { ...prev, toolsText: event.target.value } : prev))
            }
            rows={4}
            placeholder="File Retriever | Pulls relevant source docs | Bullet evidence summary"
            className={`${inputClassName()} resize-y`}
          />
        </label>

        <label className="mt-3 block text-xs text-[var(--text-secondary)]">
          Rubric Decision Rules (one per line)
          <textarea
            value={draft.decisionRulesText}
            onChange={(event) =>
              setDraft((prev) =>
                prev ? { ...prev, decisionRulesText: event.target.value } : prev
              )
            }
            rows={3}
            className={`${inputClassName()} resize-y`}
          />
        </label>

        <div className="mt-3 rounded-md border border-[var(--border-light)] bg-[var(--bg-secondary)] px-3 py-2">
          <label className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            Enabled for execution/review
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) =>
                setDraft((prev) => (prev ? { ...prev, enabled: event.target.checked } : prev))
              }
              className="h-4 w-4 accent-[var(--brand-primary)]"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-[var(--status-error)]">{error}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border-medium)] bg-[var(--deck-frost-strong)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            data-testid="crew-identity-save"
            className="rounded-md border border-[var(--brand-primary)] bg-[var(--brand-primary)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--brand-secondary)] disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Identity"}
          </button>
        </div>
      </div>
    </div>
  );
}
