"use client";

import { type ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  noPadding?: boolean;
}

export function Panel({ children, className = "", header, noPadding = false }: PanelProps) {
  return (
    <div className={`glass-panel ${className}`}>
      {header && (
        <div className="flex items-center justify-between border-b border-[var(--deck-edge)] px-4 py-3">
          {header}
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>{children}</div>
    </div>
  );
}

interface PanelHeaderProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function PanelHeader({ title, icon, action }: PanelHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        {icon && <span className="text-[var(--brand-primary)]">{icon}</span>}
        <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--smoke)]">
          {title}
        </span>
      </div>
      {action}
    </>
  );
}
