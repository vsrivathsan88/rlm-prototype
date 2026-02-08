"use client";

type Status = "idle" | "syncing" | "ready" | "error";

interface StatusIndicatorProps {
  status: Status;
  label?: string;
  showLabel?: boolean;
}

const statusConfig: Record<Status, { dotClass: string; label: string; badgeClass: string }> = {
  idle: {
    dotClass: "bg-[var(--text-tertiary)]",
    label: "Ready to start",
    badgeClass: "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]",
  },
  syncing: {
    dotClass: "status-dot-working",
    label: "Gathering your files...",
    badgeClass: "status-badge-working",
  },
  ready: {
    dotClass: "status-dot-success",
    label: "All set!",
    badgeClass: "status-badge-success",
  },
  error: {
    dotClass: "bg-[var(--status-error)]",
    label: "Something went wrong",
    badgeClass: "status-badge-warning",
  },
};

export function StatusIndicator({ status, label, showLabel = true }: StatusIndicatorProps) {
  const config = statusConfig[status];

  if (!showLabel) {
    return <div className={`status-dot ${config.dotClass}`} />;
  }

  return (
    <div className={`status-badge ${config.badgeClass}`}>
      <div className={`status-dot ${config.dotClass}`} />
      <span className="text-sm font-medium">{label || config.label}</span>
    </div>
  );
}
