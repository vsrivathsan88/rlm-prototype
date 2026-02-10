/**
 * TipTap extension that renders inline comment-thread markers.
 *
 * Markers are lightweight widgets anchored to thread start positions.
 * Clicking a marker opens the thread bubble and selects the thread.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { CommentThread } from "@/lib/store";

export const commentThreadsPluginKey = new PluginKey("commentThreads");

export interface CommentThreadsStorage {
  threadsRef: { current: CommentThread[] };
  activeThreadIdRef: { current: string | null };
  onClickRef: { current: (threadId: string, rect?: DOMRect) => void };
  onHoverRef: { current: (threadId: string | null, rect?: DOMRect) => void };
}

export const CommentThreadsExtension = Extension.create<
  Record<string, never>,
  CommentThreadsStorage
>({
  name: "commentThreads",

  addStorage() {
    return {
      threadsRef: { current: [] },
      activeThreadIdRef: { current: null },
      onClickRef: { current: () => {} },
      onHoverRef: { current: () => {} },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin({
        key: commentThreadsPluginKey,

        state: {
          init() {
            return DecorationSet.empty;
          },

          apply(_tr, _oldSet, _oldState, newState) {
            const threads = storage.threadsRef.current.filter(
              (thread) =>
                thread.status === "open" &&
                Number.isFinite(thread.anchor.startPos) &&
                Number.isFinite(thread.anchor.endPos)
            );
            if (!threads.length) return DecorationSet.empty;

            const docSize = newState.doc.content.size;
            const decorations: Decoration[] = [];

            for (const thread of threads) {
              const from = Math.max(1, Math.min(thread.anchor.startPos, docSize));
              const to = Math.max(from, Math.min(thread.anchor.endPos, docSize));
              const isActive = thread.id === storage.activeThreadIdRef.current;

              // lightweight highlight to show threaded region
              decorations.push(
                Decoration.inline(from, to, {
                  class: isActive ? "comment-thread-active" : "comment-thread",
                  style: [
                    `background-color: ${thread.color.bg}`,
                    `box-shadow: inset 0 -2px 0 ${thread.color.underline}66`,
                  ].join("; "),
                  "data-thread-id": thread.id,
                })
              );

              const marker = document.createElement("button");
              marker.type = "button";
              marker.className = isActive
                ? "comment-thread-marker comment-thread-marker-active"
                : "comment-thread-marker";
              marker.setAttribute("data-thread-id", thread.id);
              marker.style.cssText = [
                `border: 1px solid ${thread.color.underline}`,
                `color: ${thread.color.underline}`,
                `background: ${thread.color.bg}`,
                "border-radius: 999px",
                "font-size: 10px",
                "font-weight: 700",
                "line-height: 1",
                "padding: 2px 6px",
                "margin-right: 4px",
                "cursor: pointer",
                "vertical-align: middle",
              ].join("; ");
              marker.textContent = "Note";
              marker.title = thread.judge_name
                ? `${thread.judge_name}: ${thread.messages[0]?.body || "Comment thread"}`
                : thread.messages[0]?.body || "Comment thread";

              decorations.push(
                Decoration.widget(from, marker, {
                  side: -1,
                  key: `thread-marker-${thread.id}`,
                })
              );
            }

            return DecorationSet.create(newState.doc, decorations);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state) ?? DecorationSet.empty;
          },

          handleDOMEvents: {
            mouseover(_view, event) {
              const target = event.target as HTMLElement;
              const threadEl = target.closest("[data-thread-id]");
              if (threadEl) {
                const threadId = threadEl.getAttribute("data-thread-id");
                if (threadId) {
                  storage.onHoverRef.current(threadId, threadEl.getBoundingClientRect());
                }
              } else {
                storage.onHoverRef.current(null);
              }
              return false;
            },
            mouseout(_view, event) {
              const target = event.relatedTarget as HTMLElement | null;
              if (!target?.closest("[data-thread-id]")) {
                storage.onHoverRef.current(null);
              }
              return false;
            },
            click(_view, event) {
              const target = event.target as HTMLElement;
              const threadEl = target.closest("[data-thread-id]");
              if (!threadEl) return false;
              const threadId = threadEl.getAttribute("data-thread-id");
              if (!threadId) return false;
              storage.onClickRef.current(threadId, threadEl.getBoundingClientRect());
              return true;
            },
          },
        },
      }),
    ];
  },
});
