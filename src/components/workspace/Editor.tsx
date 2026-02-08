"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { KeyboardShortcut } from "@/components/ui/KeyboardShortcut";
import {
  ReviewAnnotationsExtension,
  type AnnotationWithColor,
} from "@/lib/extensions/review-annotations";

interface EditorProps {
  onCmdK: () => void;
  disabled?: boolean;
  annotations?: AnnotationWithColor[];
  activeAnnotationId?: string | null;
  onAnnotationClick?: (annotationId: string) => void;
  onAnnotationHover?: (annotationId: string | null, rect?: DOMRect) => void;
  editorRef?: (editor: TiptapEditor | null) => void;
}

export function Editor({
  onCmdK,
  disabled,
  annotations = [],
  activeAnnotationId = null,
  onAnnotationClick,
  onAnnotationHover,
  editorRef,
}: EditorProps) {
  const annotationsRef = useRef<AnnotationWithColor[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const onClickRef = useRef<(id: string) => void>(() => {});
  const onHoverRef = useRef<(id: string | null, rect?: DOMRect) => void>(() => {});

  // Keep refs in sync with props
  annotationsRef.current = annotations;
  activeIdRef.current = activeAnnotationId;
  onClickRef.current = onAnnotationClick ?? (() => {});
  onHoverRef.current = onAnnotationHover ?? (() => {});

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start drafting your document...",
      }),
      ReviewAnnotationsExtension,
    ],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "focus:outline-none",
      },
    },
  });

  // Wire up the extension's storage refs to our React refs
  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === "reviewAnnotations"
    );
    if (ext?.storage) {
      const storage = ext.storage as Record<string, unknown>;
      storage.annotationsRef = annotationsRef;
      storage.activeIdRef = activeIdRef;
      storage.onClickRef = onClickRef;
      storage.onHoverRef = onHoverRef;
    }
  }, [editor]);

  // Force decoration recalculation when annotations or activeId change
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // Dispatch an empty transaction to trigger plugin's apply()
    editor.view.dispatch(editor.state.tr);
  }, [editor, annotations, activeAnnotationId]);

  // Expose editor to parent
  useEffect(() => {
    editorRef?.(editor ?? null);
    return () => editorRef?.(null);
  }, [editor, editorRef]);

  // Word count
  const wordCount = editor?.getText().split(/\s+/).filter(Boolean).length ?? 0;

  return (
    <Panel
      className="flex-1 flex flex-col"
      header={
        <PanelHeader
          title="Editor"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          }
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCmdK}
                disabled={disabled}
                className="gap-2"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 15l5 5M4 11a7 7 0 1014 0 7 7 0 00-14 0z" />
                </svg>
                Command
                <KeyboardShortcut keys={["⌘", "K"]} />
              </Button>
            </div>
          }
        />
      }
      noPadding
    >
      <div className="flex-1 p-6 overflow-auto">
        <div className="tiptap-editor max-w-3xl">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="border-t border-[var(--glass-border)] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--smoke)]">
          <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
          <span className="text-[var(--zinc)]">|</span>
          <span>Draft</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export
          </Button>
        </div>
      </div>
    </Panel>
  );
}
