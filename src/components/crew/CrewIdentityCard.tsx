"use client";

import type { Doer, Reviewer } from "@/lib/store";

type CrewKind = "doer" | "reviewer";

interface CrewIdentityCardProps {
  kind: CrewKind;
  member: Doer | Reviewer;
  showToggle?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  onEdit?: () => void;
  className?: string;
}

const DOER_SIGILS = ["⚙", "🧭", "🛠", "🚀", "📐", "🧪"];
const REVIEWER_SIGILS = ["🔎", "🛡", "📏", "🧠", "📝", "🧬"];
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, var(--status-warning-bg) 0%, var(--brand-secondary) 100%)",
  "linear-gradient(135deg, var(--status-info-bg) 0%, var(--brand-accent) 100%)",
  "linear-gradient(135deg, var(--status-error-bg) 0%, var(--coral) 100%)",
  "linear-gradient(135deg, var(--status-success-bg) 0%, var(--phosphor) 100%)",
  "linear-gradient(135deg, var(--bg-tertiary) 0%, var(--border-medium) 100%)",
  "linear-gradient(135deg, var(--interactive-hover) 0%, var(--brand-primary) 100%)",
];

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
  }
  return hash;
}

function summarize(member: Doer | Reviewer, kind: CrewKind): string {
  if (kind === "doer") {
    return (member as Doer).description || "Executes scoped work.";
  }
  const reviewer = member as Reviewer;
  return reviewer.reason || reviewer.description || "Reviews output quality.";
}

function strictnessLabel(value: "low" | "medium" | "high" | undefined): string {
  if (value === "low") return "Light Critique";
  if (value === "high") return "Strict";
  return "Balanced";
}

function strictnessTone(value: "low" | "medium" | "high" | undefined): string {
  if (value === "low") return "border-[var(--border-light)] bg-[var(--status-success-bg)] text-[var(--status-success)]";
  if (value === "high") return "border-[var(--border-light)] bg-[var(--status-error-bg)] text-[var(--status-error)]";
  return "border-[var(--border-light)] bg-[var(--status-warning-bg)] text-[var(--status-warning)]";
}

export function CrewIdentityCard({
  kind,
  member,
  showToggle = true,
  onToggleEnabled,
  onEdit,
  className = "",
}: CrewIdentityCardProps) {
  const seed = `${kind}:${member.id}:${member.name}`;
  const index = stableHash(seed);
  const sigils = kind === "doer" ? DOER_SIGILS : REVIEWER_SIGILS;
  const sigil = sigils[index % sigils.length];
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const summary = summarize(member, kind);
  const skills = (member.skills || []).slice(0, 3);
  const goals = (member.goals_kpis || []).slice(0, 2);
  const toneLabel = strictnessLabel(member.strictness);

  return (
    <article
      className={`glass-panel rounded-2xl p-3 ${className}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="h-10 w-10 rounded-xl border border-[var(--border-light)] shadow-[var(--shadow-sm)]"
            style={{ background: gradient }}
            aria-hidden="true"
          >
            <div className="flex h-full w-full items-center justify-center text-xl">{sigil}</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{member.name}</div>
            <div className="text-[11px] font-mono text-[var(--text-tertiary)]">@{member.id}</div>
          </div>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            data-testid={`crew-edit-${member.id}`}
            className="rounded-md border border-[var(--border-medium)] bg-[var(--deck-frost-strong)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            Edit
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-[var(--border-light)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
          {kind === "doer" ? "Doer / Builder" : "Reviewer / Critic"}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${strictnessTone(member.strictness)}`}
        >
          {toneLabel}
        </span>
      </div>

      <p className="text-xs leading-5 text-[var(--text-secondary)]">{summary}</p>

      {(skills.length > 0 || goals.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <span
              key={`${member.id}-skill-${skill}`}
              className="rounded-full border border-[var(--border-light)] bg-[var(--status-info-bg)] px-2 py-0.5 text-[10px] text-[var(--status-info)]"
            >
              {skill}
            </span>
          ))}
          {goals.map((goal) => (
            <span
              key={`${member.id}-goal-${goal}`}
              className="rounded-full border border-[var(--border-light)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] text-[var(--status-warning)]"
            >
              {goal}
            </span>
          ))}
        </div>
      )}

      {showToggle && (
        <div className="mt-3 flex items-center justify-between border-t border-[var(--border-light)] pt-2">
          <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {member.enabled ? "Active" : "Paused"}
          </span>
          <input
            type="checkbox"
            checked={member.enabled}
            onChange={(event) => onToggleEnabled?.(event.target.checked)}
            className="h-4 w-4 accent-[var(--brand-primary)]"
          />
        </div>
      )}
    </article>
  );
}
