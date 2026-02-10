/**
 * TipTap extension that renders reviewer annotations as ProseMirror decorations.
 *
 * Two decoration types:
 * 1. Inline decorations — colored underlines on the annotated text range
 * 2. Widget decorations — "!" exclamation icons at the start of warning/critical annotations
 *
 * Uses a mutable ref pattern: the extension reads annotations from a React ref
 * so annotations can be updated without recreating the editor.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { ReviewAnnotation } from "@/lib/store";
import type { ReviewerColor } from "@/lib/reviewer-colors";

export interface AnnotationWithColor extends ReviewAnnotation {
  color: ReviewerColor;
}

export const reviewAnnotationsPluginKey = new PluginKey("reviewAnnotations");

function colorWithAlpha(color: string, alpha: number): string {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const hex = color.trim();
  if (hex.startsWith("#")) {
    const raw = hex.slice(1);
    if (raw.length === 3) {
      const r = parseInt(raw[0] + raw[0], 16);
      const g = parseInt(raw[1] + raw[1], 16);
      const b = parseInt(raw[2] + raw[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    }
    if (raw.length === 6) {
      const r = parseInt(raw.slice(0, 2), 16);
      const g = parseInt(raw.slice(2, 4), 16);
      const b = parseInt(raw.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    }
  }
  return color;
}

export interface ReviewAnnotationsStorage {
  annotationsRef: { current: AnnotationWithColor[] };
  activeIdRef: { current: string | null };
  onClickRef: { current: (id: string) => void };
  onHoverRef: { current: (id: string | null, rect?: DOMRect) => void };
}

export const ReviewAnnotationsExtension = Extension.create<
  Record<string, never>,
  ReviewAnnotationsStorage
>({
  name: "reviewAnnotations",

  addStorage() {
    return {
      annotationsRef: { current: [] },
      activeIdRef: { current: null },
      onClickRef: { current: () => {} },
      onHoverRef: { current: () => {} },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin({
        key: reviewAnnotationsPluginKey,

        state: {
          init() {
            return DecorationSet.empty;
          },

          apply(_tr, _oldSet, _oldState, newState) {
            const annotations = storage.annotationsRef.current;
            const activeId = storage.activeIdRef.current;

            if (annotations.length === 0) {
              return DecorationSet.empty;
            }

            const decorations: Decoration[] = [];

            for (const annotation of annotations) {
              if (
                annotation.startPos == null ||
                annotation.endPos == null ||
                annotation.startPos >= annotation.endPos
              ) {
                continue;
              }

              // Clamp positions to document bounds
              const docSize = newState.doc.content.size;
              const from = Math.max(1, Math.min(annotation.startPos, docSize));
              const to = Math.max(from, Math.min(annotation.endPos, docSize));

              if (from >= to) continue;

              const isActive = annotation.id === activeId;

              // Determine underline style based on severity
              let textDecoStyle: string;
              switch (annotation.severity) {
                case "critical":
                  textDecoStyle = `underline wavy ${annotation.color.underline}`;
                  break;
                case "warning":
                  textDecoStyle = `underline solid ${annotation.color.underline}`;
                  break;
                default:
                  textDecoStyle = `underline dotted ${annotation.color.underline}`;
                  break;
              }

              const thickness =
                annotation.severity === "critical" ? "2.5px" : "2px";
              const overlayColor = colorWithAlpha(annotation.color.underline, 0.2);
              const activeOverlayColor = colorWithAlpha(annotation.color.underline, 0.28);

              // Inline decoration: colored underline
              decorations.push(
                Decoration.inline(from, to, {
                  class: `review-annotation${isActive ? " review-annotation-active" : ""}`,
                  style: [
                    `text-decoration: ${textDecoStyle}`,
                    `text-decoration-thickness: ${thickness}`,
                    `text-underline-offset: 3px`,
                    `background-color: ${isActive ? activeOverlayColor : overlayColor}`,
                  ]
                    .filter(Boolean)
                    .join("; "),
                  "data-annotation-id": annotation.id,
                  "data-judge-id": annotation.judgeId,
                  "data-severity": annotation.severity,
                })
              );

              // Widget decoration: exclamation icon for warning/critical
              if (
                annotation.severity === "warning" ||
                annotation.severity === "critical"
              ) {
                const icon = document.createElement("span");
                icon.className = `review-annotation-icon review-annotation-icon-${annotation.severity}`;
                icon.setAttribute("data-annotation-id", annotation.id);
                icon.style.cssText = [
                  `color: ${annotation.color.underline}`,
                  "display: inline-flex",
                  "align-items: center",
                  "justify-content: center",
                  "width: 16px",
                  "height: 16px",
                  "font-size: 11px",
                  "font-weight: 700",
                  "border-radius: 50%",
                  `background: ${overlayColor}`,
                  `border: 1.5px solid ${annotation.color.underline}`,
                  "margin-right: 2px",
                  "cursor: pointer",
                  "vertical-align: middle",
                  "line-height: 1",
                  "position: relative",
                  "top: -1px",
                  "user-select: none",
                ].join("; ");
                icon.textContent = "!";
                icon.title = annotation.message;

                decorations.push(
                  Decoration.widget(from, icon, {
                    side: -1,
                    key: `icon-${annotation.id}`,
                  })
                );
              }
            }

            return DecorationSet.create(newState.doc, decorations);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state) ?? DecorationSet.empty;
          },

          handleDOMEvents: {
            mouseover(view, event) {
              const target = event.target as HTMLElement;
              const el = target.closest("[data-annotation-id]");

              if (el) {
                const id = el.getAttribute("data-annotation-id");
                if (id) {
                  const rect = el.getBoundingClientRect();
                  storage.onHoverRef.current(id, rect);
                }
              } else {
                storage.onHoverRef.current(null);
              }

              return false;
            },

            mouseout(_view, event) {
              const target = event.relatedTarget as HTMLElement | null;
              if (!target?.closest("[data-annotation-id]")) {
                storage.onHoverRef.current(null);
              }
              return false;
            },

            click(_view, event) {
              const target = event.target as HTMLElement;
              const iconEl = target.closest(".review-annotation-icon");

              if (iconEl) {
                const id = iconEl.getAttribute("data-annotation-id");
                if (id) {
                  storage.onClickRef.current(id);
                }
                return true;
              }

              return false;
            },
          },
        },
      }),
    ];
  },
});
