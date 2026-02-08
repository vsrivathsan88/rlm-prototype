"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";

interface FileUploadProps {
  projectId: string;
  onUploadComplete: () => void;
}

export function FileUpload({ projectId, onUploadComplete }: FileUploadProps) {
  const { updateProject, setGlobalActivity } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Enable directory picking in browsers that support this attribute.
    if (!folderInputRef.current) return;
    folderInputRef.current.setAttribute("webkitdirectory", "");
    folderInputRef.current.setAttribute("directory", "");
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      await uploadFiles(files, "files");
    },
    [projectId]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      await uploadFiles(files, "files");
    },
    [projectId]
  );

  const handleFolderSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      await uploadFiles(files, "folder");
    },
    [projectId]
  );

  const uploadFiles = async (files: File[], mode: "files" | "folder") => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadedCount(0);
    updateProject(projectId, { syncStatus: "syncing" });
    setGlobalActivity({
      title: mode === "folder" ? "Importing local folder" : "Uploading files",
      detail: "Preparing files for the project workspace",
      progressCurrent: 0,
      progressTotal: files.length,
    });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relativePath =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("rel_path", relativePath);

        await fetch(`http://localhost:8000/v1/projects/${projectId}/files/upload`, {
          method: "POST",
          body: formData,
        });

        setUploadedCount(i + 1);
        setGlobalActivity({
          title: mode === "folder" ? "Importing local folder" : "Uploading files",
          detail:
            mode === "folder"
              ? "Keeping your folder structure in sync"
              : "Adding selected files to project storage",
          progressCurrent: i + 1,
          progressTotal: files.length,
        });
      }

      updateProject(projectId, { syncStatus: "done" });
      onUploadComplete();
    } catch (error) {
      console.error("Upload failed:", error);
      updateProject(projectId, { syncStatus: "idle" });
      alert("Failed to upload files. Please try again.");
    } finally {
      setUploading(false);
      setGlobalActivity(null);
    }
  };

  return (
    <Panel
      header={
        <PanelHeader
          title="Add Files to Your Project"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
          }
        />
      }
    >
      <p className="text-xs text-[var(--smoke)] mb-4">
        Upload files or import a full folder so reviewers can use real project context.
      </p>

      {/* Drag and drop area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8
          transition-all duration-200
          ${isDragging
            ? "border-[var(--phosphor)] bg-[var(--phosphor-glow)]"
            : "border-[var(--zinc)] bg-[var(--graphite)]/30 hover:border-[var(--ash)]"
          }
          ${uploading ? "opacity-60 pointer-events-none" : ""}
        `}
      >
        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div className="mb-4">
            {uploading ? (
              <svg
                className="animate-spin text-[var(--phosphor)]"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-[var(--smoke)]"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            )}
          </div>

          {/* Text */}
          <div className="space-y-2">
            <p className="text-sm text-[var(--pearl)]">
              {uploading
                ? `Uploading files... (${uploadedCount} uploaded)`
                : "Drag and drop files here"
              }
            </p>
            <p className="text-xs text-[var(--smoke)]">
              or
            </p>
          </div>

          {/* File picker button */}
          <label className="mt-4">
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".txt,.md,.pdf,.doc,.docx"
              disabled={uploading}
            />
            <Button
              variant="primary"
              size="sm"
              disabled={uploading}
              onClick={(e) => {
                e.preventDefault();
                (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
              }}
            >
              Browse Files
            </Button>
          </label>

          <label className="mt-2">
            <input
              ref={folderInputRef}
              type="file"
              multiple
              onChange={handleFolderSelect}
              className="hidden"
              disabled={uploading}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={(e) => {
                e.preventDefault();
                folderInputRef.current?.click();
              }}
            >
              Import Folder
            </Button>
          </label>

          {/* Supported formats */}
          <p className="text-xs text-[var(--ash)] mt-4">
            Supports: .txt, .md, .pdf, .doc, .docx
          </p>
        </div>
      </div>

      {/* Help text */}
      <div className="mt-4 p-3 bg-[var(--graphite)]/50 rounded border border-[var(--zinc)]">
        <p className="text-xs text-[var(--silver)] leading-relaxed">
          <span className="font-medium text-[var(--pearl)]">💡 Tip:</span> Upload brand guidelines,
          past campaigns, competitive docs, or any reference materials. AI reviewers will use these
          to provide contextual feedback on your documents.
        </p>
      </div>

      {/* Skip option */}
      <div className="mt-4 text-center">
        <button
          onClick={onUploadComplete}
          className="text-xs text-[var(--smoke)] hover:text-[var(--pearl)] transition-colors"
        >
          Skip for now →
        </button>
      </div>
    </Panel>
  );
}
