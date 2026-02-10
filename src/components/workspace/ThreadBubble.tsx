"use client";

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import type { CommentThread } from "@/lib/store";

interface ThreadBubbleProps {
  thread: CommentThread | null;
  rect: DOMRect | null;
  onClose: () => void;
  onAccept: (threadId: string) => void;
  onReject: (threadId: string) => void;
  onRevert: (threadId: string) => void;
  onResolve: (threadId: string) => void;
}

export function ThreadBubble({
  thread,
  rect,
  onClose,
  onAccept,
  onReject,
  onRevert,
  onResolve,
}: ThreadBubbleProps) {
  if (!thread || !rect) return null;

  const style: React.CSSProperties = {
    top: rect.top - 10,
    left: rect.left + rect.width / 2,
    transform: "translate(-50%, -100%)",
  };

  if (rect.top < 190) {
    style.top = rect.bottom + 10;
    style.transform = "translate(-50%, 0)";
  }

  const suggestion = thread.suggestion;

  const bubble = (
    <div
      className="fixed z-[80] w-[340px] rounded-lg border border-[var(--border-medium)] bg-[var(--deck-frost-strong)] p-3 shadow-[var(--shadow-lg)]"
      style={style}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[var(--text-primary)]">
            {thread.judge_name || "Reviewer Thread"}
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)]">
            {thread.severity.toUpperCase()} · L{thread.anchor.startLine}
            {thread.anchor.endLine !== thread.anchor.startLine ? `-${thread.anchor.endLine}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-[var(--border-medium)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
        >
          Close
        </button>
      </div>

      <div className="max-h-[160px] space-y-1 overflow-auto pr-1">
        {thread.messages.map((message) => (
          <div key={message.id} className="rounded border border-[var(--border-light)] bg-[var(--bg-primary)] px-2 py-1">
            <div className="text-[10px] text-[var(--text-tertiary)]">
              {message.author_name} · {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">{message.body}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {suggestion?.status === "pending" && (
          <>
            <Button variant="secondary" size="sm" onClick={() => onAccept(thread.id)}>
              Accept
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onReject(thread.id)}>
              Reject
            </Button>
          </>
        )}
        {suggestion?.status === "accepted" && (
          <Button variant="secondary" size="sm" onClick={() => onRevert(thread.id)}>
            Revert
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onResolve(thread.id)}>
          Resolve
        </Button>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(bubble, document.body);
}

