"use client";

import Link from "next/link";
import { type Project, type TreeNode } from "@/lib/store";
import { Badge } from "@/components/ui/Badge";
import { connectorLabel } from "@/lib/connectors";

interface SidebarProps {
  projects: Project[];
  selectedProject?: Project;
  onSelectProject: (id: string) => void;
}

export function Sidebar({ projects, selectedProject, onSelectProject }: SidebarProps) {
  return (
    <aside className="w-60 flex-shrink-0 border-r border-[var(--deck-edge)] bg-[var(--deck-frost)] backdrop-blur-md flex flex-col">
      {/* Projects Section */}
      <div className="p-4 border-b border-[var(--deck-edge)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">
            Projects
          </span>
          <Link href="/projects/new" className="text-[var(--phosphor)] hover:text-[var(--phosphor-bright)] transition-colors" title="New Project">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>

        <div className="space-y-1">
          {projects.length === 0 && (
            <div className="py-8 text-center">
              <div className="text-[var(--ash)] text-xs mb-2">No projects yet</div>
              <Link
                href="/projects/new?first=true"
                className="text-[10px] font-mono text-[var(--phosphor)] hover:text-[var(--phosphor-bright)] transition-colors"
              >
                Create project →
              </Link>
            </div>
          )}
          {projects.map((project, index) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`
                w-full text-left px-3 py-2 transition-all duration-150
                animate-fade-in-up stagger-${Math.min(index + 1, 5)}
                ${selectedProject?.id === project.id
                  ? "bg-[var(--phosphor-glow)] border-l-2 border-[var(--phosphor)] shadow-[var(--shadow-sm)]"
                  : "hover:bg-[var(--deck-frost-strong)] border-l-2 border-transparent"
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm truncate ${selectedProject?.id === project.id ? "text-[var(--pearl)]" : "text-[var(--silver)]"}`}>
                  {project.name}
                </span>
              </div>
              {project.connector && (
                <span className="text-[10px] font-mono text-[var(--ash)] mt-0.5 block">
                  {connectorLabel(project.connector)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Files Section */}
      {selectedProject && (
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--smoke)]">
              Files
            </span>
            {selectedProject.syncStatus === "syncing" && (
              <Badge variant="amber">Syncing</Badge>
            )}
            {selectedProject.syncStatus === "done" && (
              <Badge variant="phosphor">Ready</Badge>
            )}
          </div>

          <FileTree nodes={selectedProject.files || []} />
        </div>
      )}
    </aside>
  );
}

function FileTree({ nodes }: { nodes: TreeNode[] }) {
  if (nodes.length === 0) {
    return (
      <div className="py-6 text-center">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mx-auto text-[var(--zinc)] mb-2"
        >
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <div className="text-[var(--ash)] text-xs">No files synced</div>
        <div className="text-[10px] text-[var(--zinc)] mt-1">Connect a folder to start</div>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <FileNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}

function FileNode({ node, depth }: { node: TreeNode; depth: number }) {
  const isFolder = node.type === "folder";

  return (
    <div>
      <button
        className={`
          w-full text-left px-2 py-1.5 flex items-center gap-2
          hover:bg-[var(--deck-frost-strong)] transition-colors
          text-[var(--silver)] text-xs
        `}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {isFolder ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--amber)] flex-shrink-0">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--smoke)] flex-shrink-0">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
        )}
        <span className="truncate">{node.name}</span>
        {isFolder && node.children && (
          <span className="text-[10px] font-mono text-[var(--ash)] ml-auto">
            {node.children.length}
          </span>
        )}
      </button>
      {isFolder && node.children && (
        <div>
          {node.children.map((child) => (
            <FileNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
