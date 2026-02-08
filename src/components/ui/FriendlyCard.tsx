"use client";

import { ReactNode } from "react";

interface FriendlyCardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function FriendlyCard({
  children,
  title,
  subtitle,
  icon,
  action,
  className = ""
}: FriendlyCardProps) {
  return (
    <div className={`friendly-panel ${className}`}>
      {(title || icon || action) && (
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-secondary)] flex items-center justify-center text-white flex-shrink-0">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-[var(--text-secondary)]">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && (
            <button
              onClick={action.onClick}
              className="friendly-button friendly-button-secondary text-sm"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
