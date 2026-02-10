"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { Button } from "@/components/ui/Button";

interface HeaderProps {
  projectName?: string;
  syncStatus?: "idle" | "syncing" | "ready" | "error";
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

const ADMIN_UNLOCK_FLAG = "rlm_admin_unlocked";
const KONAMI_SEQUENCE = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowleft",
  "arrowright",
  "b",
  "a",
];

export function Header({
  projectName,
  syncStatus = "idle",
  focusMode = false,
  onToggleFocusMode,
}: HeaderProps) {
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(ADMIN_UNLOCK_FLAG) === "1";
  });
  const [konamiProgress, setKonamiProgress] = useState(0);

  useEffect(() => {
    if (adminUnlocked || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase() || "";
      const isTypingSurface =
        tagName === "input" ||
        tagName === "textarea" ||
        (target?.getAttribute("contenteditable") ?? "false") === "true";
      if (isTypingSurface) return;

      const key = event.key.toLowerCase();
      const expected = KONAMI_SEQUENCE[konamiProgress];
      if (key === expected) {
        const next = konamiProgress + 1;
        if (next >= KONAMI_SEQUENCE.length) {
          setAdminUnlocked(true);
          setKonamiProgress(0);
          window.sessionStorage.setItem(ADMIN_UNLOCK_FLAG, "1");
          return;
        }
        setKonamiProgress(next);
        return;
      }
      setKonamiProgress(key === KONAMI_SEQUENCE[0] ? 1 : 0);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [adminUnlocked, konamiProgress]);

  const lockAdminMode = () => {
    setAdminUnlocked(false);
    setKonamiProgress(0);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ADMIN_UNLOCK_FLAG);
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-[var(--deck-edge)] bg-[var(--deck-frost)] px-6 py-4 shadow-[var(--shadow-sm)] backdrop-blur-md">
      <div className="flex items-center gap-6">
        {/* Logo - Friendly and approachable */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-[linear-gradient(135deg,var(--brand-primary)_0%,var(--brand-secondary)_100%)] flex items-center justify-center shadow-[var(--shadow-md)] group-hover:shadow-[var(--shadow-lg)] transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.8" />
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors">
              {projectName || "My Workspace"}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              Draft • Review • Collaborate
            </span>
          </div>
        </Link>

        {/* Divider */}
        <div className="h-8 w-px bg-[var(--deck-edge)]" />

        {/* Status - Plain language */}
        <StatusIndicator status={syncStatus} />
      </div>

      <nav className="flex items-center gap-3">
        {onToggleFocusMode && (
          <Button variant={focusMode ? "primary" : "secondary"} size="sm" onClick={onToggleFocusMode}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
            {focusMode ? "Focus: On" : "Focus: Off"}
          </Button>
        )}
        <Link href="/projects/new">
          <Button variant="secondary" size="sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Project
          </Button>
        </Link>
        <Link href="/onboarding">
          <Button variant="ghost" size="sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            Settings
          </Button>
        </Link>
        {adminUnlocked && (
          <>
            <Link href="/admin/control">
              <Button variant="ghost" size="sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
                Ops
              </Button>
            </Link>
            <button
              type="button"
              onClick={lockAdminMode}
              className="rounded border border-[var(--deck-edge)] px-2 py-1 text-[10px] text-[var(--ash)] hover:text-[var(--pearl)]"
              title="Lock admin shortcuts"
            >
              Lock
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
