"use client";

import { ReactNode } from "react";
import { FriendlyCard } from "@/components/ui/FriendlyCard";
import { ProgressIndicator } from "@/components/ui/ProgressIndicator";

interface AgentTask {
  id: string;
  type: "drafting" | "reviewing" | "syncing" | "analyzing";
  description: string;
  progress: number;
  status: "running" | "queued" | "completed";
}

interface ConflictItem {
  id: string;
  location: string;
  description: string;
  reviewers: string[];
  severity: "low" | "medium" | "high";
}

interface ActivityItem {
  id: string;
  type: "draft" | "review" | "sync" | "approval";
  description: string;
  timestamp: string;
  icon: ReactNode;
}

interface SuggestedAction {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}

interface AgenticDashboardProps {
  projectName: string;
  agentTasks: AgentTask[];
  conflictsNeedingAttention: ConflictItem[];
  recentActivity: ActivityItem[];
  suggestedActions: SuggestedAction[];
}

export function AgenticDashboard({
  projectName,
  agentTasks,
  conflictsNeedingAttention,
  recentActivity,
  suggestedActions
}: AgenticDashboardProps) {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          {projectName}
        </h1>
        <p className="text-[var(--text-secondary)]">
          Your AI workspace for drafting, reviewing, and collaborating
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Agent Status & Conflicts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agent Status */}
          <FriendlyCard
            title="What's Happening"
            subtitle="Your AI assistants are working on these tasks"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          >
            {agentTasks.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-secondary)]">
                <p>All quiet! Press Cmd+K to start a new task.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {agentTasks.map((task) => (
                  <AgentTaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </FriendlyCard>

          {/* Needs Attention */}
          {conflictsNeedingAttention.length > 0 && (
            <FriendlyCard
              title="Needs Your Attention"
              subtitle={`${conflictsNeedingAttention.length} ${conflictsNeedingAttention.length === 1 ? 'item' : 'items'} waiting for your input`}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              }
            >
              <div className="space-y-3">
                {conflictsNeedingAttention.map((conflict) => (
                  <ConflictCard key={conflict.id} conflict={conflict} />
                ))}
              </div>
            </FriendlyCard>
          )}

          {/* Recent Activity */}
          <FriendlyCard
            title="Recent Activity"
            subtitle="What's been happening in your workspace"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
          >
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-secondary)]">
                <p>No activity yet. Create something to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </FriendlyCard>
        </div>

        {/* Right Column - Suggested Actions */}
        <div className="space-y-6">
          <FriendlyCard
            title="Suggested Actions"
            subtitle="Things you might want to do"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
          >
            <div className="space-y-3">
              {suggestedActions.map((action) => (
                <SuggestedActionCard key={action.id} action={action} />
              ))}
            </div>
          </FriendlyCard>
        </div>
      </div>
    </div>
  );
}

// Sub-components

function AgentTaskCard({ task }: { task: AgentTask }) {
  const statusIcons = {
    running: (
      <div className="status-dot status-dot-working" />
    ),
    queued: (
      <div className="w-2 h-2 rounded-full bg-[var(--text-tertiary)]" />
    ),
    completed: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--status-success)]">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  };

  const statusLabels = {
    running: "In progress",
    queued: "Queued",
    completed: "Complete"
  };

  return (
    <div className="border border-[var(--border-light)] rounded-lg p-4 hover:border-[var(--border-medium)] transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 mt-1">
          {statusIcons[task.status]}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-[var(--text-primary)]">
              {task.description}
            </h4>
            <span className="text-xs text-[var(--text-tertiary)] ml-2">
              {statusLabels[task.status]}
            </span>
          </div>
        </div>
      </div>

      {task.status === "running" && (
        <ProgressIndicator
          value={task.progress}
          showPercentage={true}
        />
      )}
    </div>
  );
}

function ConflictCard({ conflict }: { conflict: ConflictItem }) {
  const severityConfig = {
    low: { color: "text-[var(--status-info)]", bg: "bg-[var(--status-info-bg)]" },
    medium: { color: "text-[var(--status-warning)]", bg: "bg-[var(--status-warning-bg)]" },
    high: { color: "text-[var(--status-error)]", bg: "bg-[var(--status-error-bg)]" }
  };

  const config = severityConfig[conflict.severity];

  return (
    <div className="feedback-card feedback-card-warning cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.color} mb-2`}>
            {conflict.location}
          </div>
          <p className="text-sm text-[var(--text-primary)]">
            {conflict.description}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-[var(--text-secondary)]">
          Reviewers: {conflict.reviewers.join(", ")}
        </div>
        <button className="friendly-button friendly-button-primary text-sm">
          Resolve
        </button>
      </div>
    </div>
  );
}

function ActivityCard({ activity }: { activity: ActivityItem }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
      <div className="flex-shrink-0 text-[var(--brand-primary)]">
        {activity.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)]">
          {activity.description}
        </p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          {activity.timestamp}
        </p>
      </div>
    </div>
  );
}

function SuggestedActionCard({ action }: { action: SuggestedAction }) {
  return (
    <button
      onClick={action.onClick}
      className="w-full text-left p-4 rounded-lg border border-[var(--border-light)] hover:border-[var(--brand-primary)] hover:bg-[var(--bg-tertiary)] transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-[var(--brand-primary)] group-hover:scale-110 transition-transform">
          {action.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-[var(--text-primary)] mb-1 group-hover:text-[var(--brand-primary)] transition-colors">
            {action.title}
          </h4>
          <p className="text-sm text-[var(--text-secondary)]">
            {action.description}
          </p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--brand-primary)] transition-colors">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  );
}
