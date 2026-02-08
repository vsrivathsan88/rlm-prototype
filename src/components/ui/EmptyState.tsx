"use client";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state animate-fade-in">
      {icon && (
        <div className="empty-state-icon">
          {icon}
        </div>
      )}
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="friendly-button friendly-button-primary"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Pre-built empty state icons (friendly, non-technical)
export const EmptyStateIcons = {
  NoProjects: () => (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="60" cy="60" r="50" fill="var(--bg-tertiary)" />
      <path
        d="M40 50h40M40 60h30M40 70h35"
        stroke="var(--text-tertiary)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="85" cy="75" r="15" fill="var(--brand-primary)" />
      <path
        d="M85 68v14M78 75h14"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  ),
  NoFiles: () => (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="30" y="25" width="60" height="70" rx="8" fill="var(--bg-tertiary)" />
      <path
        d="M45 45h30M45 55h25M45 65h28"
        stroke="var(--text-tertiary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="60" cy="80" r="8" fill="var(--brand-secondary)" />
      <path d="M60 76v8" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="60" cy="84" r="1.5" fill="white" />
    </svg>
  ),
  Searching: () => (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="50" cy="50" r="25" stroke="var(--brand-primary)" strokeWidth="4" fill="none" />
      <path
        d="M70 70l20 20"
        stroke="var(--brand-primary)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="15" fill="var(--status-info-bg)" />
    </svg>
  ),
  Success: () => (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="60" cy="60" r="40" fill="var(--status-success-bg)" />
      <path
        d="M40 60l15 15 25-30"
        stroke="var(--status-success)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Collaboration: () => (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <circle cx="45" cy="45" r="18" fill="var(--brand-primary)" opacity="0.3" />
      <circle cx="75" cy="45" r="18" fill="var(--brand-secondary)" opacity="0.3" />
      <circle cx="60" cy="70" r="18" fill="var(--brand-accent)" opacity="0.3" />
      <circle cx="45" cy="45" r="12" fill="var(--brand-primary)" />
      <circle cx="75" cy="45" r="12" fill="var(--brand-secondary)" />
      <circle cx="60" cy="70" r="12" fill="var(--brand-accent)" />
    </svg>
  )
};
