"use client";

import { useState, useEffect, useMemo } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { KeyboardShortcut } from "@/components/ui/KeyboardShortcut";
import { type TreeNode } from "@/lib/store";

interface FileSearchProps {
  isOpen: boolean;
  onClose: () => void;
  files: TreeNode[];
  projectId: string;
  onFileSelect: (filename: string, content?: string) => void;
}

interface FileWithContent {
  filename: string;
  path: string;
  content: string;
  size: number;
}

export function FileSearch({ isOpen, onClose, files, projectId, onFileSelect }: FileSearchProps) {
  const [query, setQuery] = useState("");
  const [fileContents, setFileContents] = useState<FileWithContent[]>([]);
  const [loading, setLoading] = useState(false);

  // Flatten tree structure to get all file paths
  const flattenFiles = (nodes: TreeNode[], parentPath: string = ""): string[] => {
    const paths: string[] = [];

    for (const node of nodes) {
      const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;

      if (node.type === "file") {
        paths.push(fullPath);
      } else if (node.type === "folder" && node.children) {
        paths.push(...flattenFiles(node.children, fullPath));
      }
    }

    return paths;
  };

  const allFilePaths = useMemo(() => flattenFiles(files), [files]);

  // Load file contents when modal opens
  useEffect(() => {
    if (!isOpen || fileContents.length > 0) return;

    const loadFileContents = async () => {
      setLoading(true);
      try {
        const contents: FileWithContent[] = [];

        for (const filepath of allFilePaths) {
          try {
            const response = await fetch(
              `http://localhost:8000/v1/projects/${projectId}/files/${encodeURIComponent(filepath)}`
            );

            if (response.ok) {
              const blob = await response.blob();
              const text = await blob.text();

              contents.push({
                filename: filepath.split('/').pop() || filepath,
                path: filepath,
                content: text,
                size: blob.size
              });
            }
          } catch (error) {
            console.error(`Failed to load ${filepath}:`, error);
          }
        }

        setFileContents(contents);
      } catch (error) {
        console.error("Failed to load files:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFileContents();
  }, [isOpen, projectId, allFilePaths, fileContents.length]);

  // Search files by name and content
  const searchResults = useMemo(() => {
    if (!query.trim()) {
      // Show all files when no query
      return fileContents.map(file => ({
        ...file,
        matches: [] as { line: number; text: string }[]
      }));
    }

    const lowerQuery = query.toLowerCase();
    const results: (FileWithContent & { matches: { line: number; text: string }[] })[] = [];

    for (const file of fileContents) {
      // Check filename match
      const filenameMatch = file.filename.toLowerCase().includes(lowerQuery);
      const pathMatch = file.path.toLowerCase().includes(lowerQuery);

      // Check content matches
      const contentMatches: { line: number; text: string }[] = [];
      const lines = file.content.split('\n');

      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(lowerQuery)) {
          contentMatches.push({
            line: idx + 1,
            text: line.trim()
          });
        }
      });

      // Include file if there's any match
      if (filenameMatch || pathMatch || contentMatches.length > 0) {
        results.push({
          ...file,
          matches: contentMatches.slice(0, 3) // Limit to 3 matches per file
        });
      }
    }

    return results;
  }, [query, fileContents]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  const handleFileClick = (file: FileWithContent & { matches: { line: number; text: string }[] }) => {
    onFileSelect(file.path, file.content);
    onClose();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-[var(--phosphor)]/30 text-[var(--phosphor-bright)]">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--void)]/80 backdrop-blur-sm animate-fade-in-up"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-3xl mx-4 animate-scale-in">
        <Panel
          header={
            <PanelHeader
              title="Search Files"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              action={
                <button
                  onClick={onClose}
                  className="text-[var(--smoke)] hover:text-[var(--pearl)] transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              }
            />
          }
          noPadding
        >
          <div className="space-y-0">
            {/* Search input */}
            <div className="p-4 border-b border-[var(--glass-border)]">
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search by filename or content..."
                  className="
                    w-full px-4 py-3
                    bg-[var(--graphite)] border border-[var(--zinc)]
                    text-[var(--pearl)] text-sm
                    placeholder:text-[var(--ash)]
                    focus:outline-none focus:border-[var(--phosphor)]/50 focus:ring-1 focus:ring-[var(--phosphor)]/20
                    transition-all
                  "
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--ash)]">
                  <KeyboardShortcut keys={["ESC"]} />
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-auto">
              {loading ? (
                <div className="p-8 text-center text-[var(--smoke)]">
                  <div className="animate-pulse">Loading files...</div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-8 text-center text-[var(--smoke)]">
                  {query ? "No matches found" : "No files uploaded"}
                </div>
              ) : (
                <div className="divide-y divide-[var(--glass-border)]">
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleFileClick(result)}
                      className="w-full text-left px-4 py-3 hover:bg-[var(--graphite)] transition-colors group"
                    >
                      {/* File header */}
                      <div className="flex items-center gap-2 mb-1">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-[var(--phosphor)] flex-shrink-0"
                        >
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                        </svg>
                        <span className="text-sm text-[var(--pearl)] font-medium group-hover:text-[var(--phosphor-bright)]">
                          {highlightMatch(result.filename, query)}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--ash)] ml-auto">
                          {(result.size / 1024).toFixed(1)} KB
                        </span>
                      </div>

                      {/* File path */}
                      <div className="text-[10px] font-mono text-[var(--smoke)] mb-2 ml-6">
                        {highlightMatch(result.path, query)}
                      </div>

                      {/* Content matches */}
                      {result.matches.length > 0 && (
                        <div className="ml-6 space-y-1">
                          {result.matches.map((match, matchIdx) => (
                            <div
                              key={matchIdx}
                              className="text-xs font-mono text-[var(--silver)] bg-[var(--carbon)]/30 px-2 py-1 rounded"
                            >
                              <span className="text-[var(--ash)] mr-2">
                                Line {match.line}:
                              </span>
                              <span className="text-[var(--pearl)]">
                                {highlightMatch(
                                  match.text.length > 80
                                    ? match.text.slice(0, 80) + "..."
                                    : match.text,
                                  query
                                )}
                              </span>
                            </div>
                          ))}
                          {fileContents
                            .find(f => f.path === result.path)
                            ?.content.split('\n')
                            .filter(line => line.toLowerCase().includes(query.toLowerCase()))
                            .length! > 3 && (
                            <div className="text-[10px] text-[var(--ash)] italic ml-2">
                              + {fileContents.find(f => f.path === result.path)!.content.split('\n').filter(line => line.toLowerCase().includes(query.toLowerCase())).length - 3} more matches
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[var(--glass-border)] bg-[var(--carbon)]/30">
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--smoke)]">
                <span>
                  {searchResults.length} {searchResults.length === 1 ? "file" : "files"}
                  {query && " found"}
                </span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <KeyboardShortcut keys={["↑", "↓"]} />
                    <span>navigate</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <KeyboardShortcut keys={["↵"]} />
                    <span>open</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
