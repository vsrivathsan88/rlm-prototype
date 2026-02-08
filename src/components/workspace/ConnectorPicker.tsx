"use client";

import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";

interface ConnectorPickerProps {
  selected: string | null;
  onSelect: (connector: string) => void;
}

const connectors = [
  {
    id: "local",
    name: "Local Folder",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    ),
    description: "Upload files from this machine",
    status: "available",
  },
  {
    id: "gdrive",
    name: "Google Drive",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.71 3.5L1.15 15l3.43 6 6.56-12.5L7.71 3.5zm1.42 0L15.7 15H2.58l3.43-6h6.56l-3.43 6L7.71 3.5h1.42zM16.84 15l-6.56 12.5h6.86L23.7 15h-6.86z" />
      </svg>
    ),
    description: "Connect your Google Drive",
    status: "available",
  },
];

export function ConnectorPicker({ selected, onSelect }: ConnectorPickerProps) {
  return (
    <Panel
      header={
        <PanelHeader
          title="Connect a Source"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
          }
        />
      }
    >
      <p className="text-xs text-[var(--smoke)] mb-4">
        Choose a source folder. We&apos;ll sync files and index them for Cmd+K queries.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {connectors.map((connector, i) => {
          const isSelected = selected === connector.id;
          const isDisabled = connector.status === "coming-soon";

          return (
            <button
              key={connector.id}
              onClick={() => !isDisabled && onSelect(connector.id)}
              disabled={isDisabled}
              className={`
                relative p-4 text-left transition-all
                animate-fade-in-up stagger-${Math.min(i + 1, 5)}
                ${isSelected
                  ? "bg-[var(--phosphor-glow)] border-2 border-[var(--phosphor)]"
                  : isDisabled
                  ? "bg-[var(--graphite)]/50 border border-[var(--zinc)]/50 opacity-50 cursor-not-allowed"
                  : "bg-[var(--graphite)] border border-[var(--zinc)] hover:border-[var(--ash)] hover:bg-[var(--slate)]"
                }
              `}
            >
              {isDisabled && (
                <Badge variant="default" className="absolute top-2 right-2">
                  Soon
                </Badge>
              )}
              <div className={`mb-2 ${isSelected ? "text-[var(--phosphor)]" : "text-[var(--smoke)]"}`}>
                {connector.icon}
              </div>
              <div className={`text-sm font-medium ${isSelected ? "text-[var(--white)]" : "text-[var(--pearl)]"}`}>
                {connector.name}
              </div>
              <div className="text-[10px] text-[var(--ash)] mt-0.5">
                {connector.description}
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
