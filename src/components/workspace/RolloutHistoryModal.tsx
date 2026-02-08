"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import type { RolloutHistoryEvent } from "@/lib/store";

interface RolloutHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  currentMode: "baseline" | "shadow" | "active";
  events: RolloutHistoryEvent[];
  onRecoverToActive?: () => void;
  isRecovering?: boolean;
}

type SourceFilter = "all" | RolloutHistoryEvent["source"];
type ModeFilter = "all" | "baseline" | "shadow" | "active";

function formatTime(value?: string): string {
  if (!value) return "unknown time";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: RolloutHistoryEvent["source"]): string {
  if (source === "auto_fallback") return "auto fallback";
  if (source === "manual") return "manual";
  if (source === "migration") return "migration";
  if (source === "hydrate") return "hydrate";
  return "init";
}

export function RolloutHistoryModal({
  isOpen,
  onClose,
  projectName,
  currentMode,
  events,
  onRecoverToActive,
  isRecovering = false,
}: RolloutHistoryModalProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)),
    [events]
  );

  const filteredEvents = useMemo(
    () =>
      sortedEvents.filter((event) => {
        if (sourceFilter !== "all" && event.source !== sourceFilter) return false;
        if (modeFilter !== "all" && event.mode !== modeFilter) return false;
        return true;
      }),
    [sortedEvents, sourceFilter, modeFilter]
  );

  const latestAutoFallback = useMemo(
    () => sortedEvents.find((event) => event.source === "auto_fallback"),
    [sortedEvents]
  );

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onEscape);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const container = dialogRef.current;
    if (!container) return;

    const tabbables = Array.from(
      container.querySelectorAll<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      )
    ).filter(
      (element) =>
        !element.hasAttribute("disabled") &&
        element.getAttribute("aria-hidden") !== "true" &&
        element.tabIndex !== -1 &&
        element.offsetParent !== null
    );

    if (tabbables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = tabbables[0];
    const last = tabbables[tabbables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (active === first || !active || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last || !active || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--void)]/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close rollout history overlay"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
        className="relative w-full max-w-3xl rounded-lg border border-[#e8e6e1] bg-white shadow-[0_18px_50px_rgba(45,45,42,0.22)]"
      >
        <div className="flex items-start justify-between border-b border-[#ece8e1] px-6 py-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#8d7a60]">
              Rollout Timeline
            </div>
            <h2 id={titleId} className="text-lg font-semibold text-[#2d2d2a]">
              {projectName || "Project"} rollout history
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-[#7b7469] transition-colors hover:text-[#2d2d2a]"
            aria-label="Close rollout history"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-6 py-4">
          {latestAutoFallback && currentMode !== "active" && onRecoverToActive && (
            <div className="rounded-md border border-[#efd0c9] bg-[#fdf1ee] p-3">
              <div className="mb-1 text-xs font-semibold text-[#8e3e2f]">
                Auto-fallback detected at {formatTime(latestAutoFallback.updated_at)}
              </div>
              <p className="text-xs text-[#6b534a]">
                The reviewer path moved to safer mode. Use guided recovery when upstream stability is restored.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onRecoverToActive}
                  disabled={isRecovering}
                >
                  {isRecovering ? "Recovering..." : "Recover to Active"}
                </Button>
                <span className="text-[11px] text-[#8f7f6a]">
                  This sets rollout mode to `active` and keeps history.
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#8d7a60]">Source</span>
            {(["all", "manual", "auto_fallback", "migration", "hydrate", "init"] as const).map((source) => {
              const label = source === "all" ? "all" : sourceLabel(source);
              return (
                <button
                  key={source}
                  onClick={() => setSourceFilter(source)}
                  aria-label={`Filter source ${label}`}
                  className={`border px-2 py-1 text-[10px] uppercase tracking-[0.08em] ${
                    sourceFilter === source
                      ? "border-[#7c674c] bg-[#f8f1e8] text-[#5d4930]"
                      : "border-[#d9d1c4] bg-white text-[#7f7566] hover:text-[#2d2d2a]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#8d7a60]">Mode</span>
            {(["all", "baseline", "shadow", "active"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setModeFilter(mode)}
                aria-label={`Filter mode ${mode}`}
                className={`border px-2 py-1 text-[10px] uppercase tracking-[0.08em] ${
                  modeFilter === mode
                    ? "border-[#7c674c] bg-[#f8f1e8] text-[#5d4930]"
                    : "border-[#d9d1c4] bg-white text-[#7f7566] hover:text-[#2d2d2a]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-auto pr-1">
            {filteredEvents.length === 0 ? (
              <div className="rounded-md border border-[#eee8dd] bg-[#fcfaf7] p-4 text-sm text-[#6f6759]">
                No rollout events match the current filters.
              </div>
            ) : (
              filteredEvents.map((event) => (
                <article
                  key={`${event.updated_at}-${event.source}-${event.mode}`}
                  className="rounded-md border border-[#ece4d9] bg-[#fffcf8] p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[#2d2d2a]">{event.mode}</div>
                    <div className="text-[11px] text-[#7f7566]">{formatTime(event.updated_at)}</div>
                  </div>
                  <div className="mt-1 text-xs text-[#5f5547]">
                    Source: <span className="font-medium">{sourceLabel(event.source)}</span>
                    {event.from_mode ? ` • from ${event.from_mode}` : ""}
                  </div>
                  {event.reason && <div className="mt-1 text-xs text-[#6b6153]">Reason: {event.reason}</div>}
                  {event.trigger && (
                    <div className="mt-1 text-[11px] text-[#8a7f70]">
                      Trigger: <span className="font-mono">{event.trigger}</span>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
