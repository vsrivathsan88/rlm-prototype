import { motion, AnimatePresence } from "framer-motion";
import {
  EditableTextField,
  EditableTextareaField,
  EditableListField,
} from "./EditableField";

interface WorkspaceDefinition {
  first_project: {
    name: string;
    description: string;
    goal: string;
    target_audience: string;
    key_messages: string[];
    success_metrics: string[];
    example_document_title: string;
    example_document_outline: string[];
  };
  reviewers: Array<{
    id: string;
    name: string;
    reason: string;
    enabled: boolean;
  }>;
  quick_actions: Array<{
    id: string;
    label: string;
    icon: string;
  }>;
  okrs: any[];
}

interface ProgressiveWorkspaceRevealProps {
  workspace: WorkspaceDefinition;
  onWorkspaceChange: (workspace: WorkspaceDefinition) => void;
  onComplete: () => void;
}

export function ProgressiveWorkspaceReveal({
  workspace,
  onWorkspaceChange,
  onComplete,
}: ProgressiveWorkspaceRevealProps) {
  // Show sections based on whether they have data
  const hasProjectName = workspace.first_project.name !== "";
  const hasProjectDetails = workspace.first_project.goal !== "";
  const hasDocument = workspace.first_project.example_document_title !== "";
  const hasReviewers = workspace.reviewers.length > 0;
  const hasQuickActions = workspace.quick_actions.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* First Project - shows as soon as we have data */}
      <AnimatePresence>
        {hasProjectName && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="glass-card p-6 border border-[#e8e6e1]"
          >
            <h3 className="text-xl font-semibold text-[#2d2d2a] mb-4 flex items-center gap-2">
              📁 First Project
            </h3>

            <div className="space-y-4">
              <EditableTextField
                label="Project Name"
                value={workspace.first_project.name}
                icon="📁"
                placeholder="Project name"
                onChange={(value) => onWorkspaceChange({
                  ...workspace,
                  first_project: { ...workspace.first_project, name: value }
                })}
                type="text"
              />

              {hasProjectDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  <EditableTextareaField
                    label="Goal"
                    value={workspace.first_project.goal}
                    icon="🎯"
                    placeholder="What's the goal?"
                    onChange={(value) => onWorkspaceChange({
                      ...workspace,
                      first_project: { ...workspace.first_project, goal: value }
                    })}
                    type="textarea"
                  />

                  <EditableListField
                    label="Key Messages"
                    value={workspace.first_project.key_messages}
                    icon="💡"
                    placeholder="Add a key message"
                    onChange={(value) => onWorkspaceChange({
                      ...workspace,
                      first_project: { ...workspace.first_project, key_messages: value }
                    })}
                    type="list"
                    maxItems={5}
                  />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* First Document */}
      <AnimatePresence>
        {hasDocument && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="glass-card p-6 border border-[#e8e6e1]"
          >
            <h3 className="text-xl font-semibold text-[#2d2d2a] mb-4 flex items-center gap-2">
              📄 First Document
            </h3>

            <div className="space-y-4">
              <EditableTextField
                label="Document Title"
                value={workspace.first_project.example_document_title}
                icon="📄"
                placeholder="Document title"
                onChange={(value) => onWorkspaceChange({
                  ...workspace,
                  first_project: { ...workspace.first_project, example_document_title: value }
                })}
                type="text"
              />

              <EditableListField
                label="Document Outline"
                value={workspace.first_project.example_document_outline}
                icon="📋"
                placeholder="Add a section"
                onChange={(value) => onWorkspaceChange({
                  ...workspace,
                  first_project: { ...workspace.first_project, example_document_outline: value }
                })}
                type="list"
                maxItems={10}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviewers */}
      <AnimatePresence>
        {hasReviewers && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="glass-card p-6 border border-[#e8e6e1]"
          >
            <h3 className="text-xl font-semibold text-[#2d2d2a] mb-4 flex items-center gap-2">
              🔍 Pre-Selected Reviewers
            </h3>
            <p className="text-sm text-[#6b6b63] mb-4">
              These reviewers will help ensure your content meets quality standards
            </p>

            <div className="space-y-3">
              {workspace.reviewers.map((reviewer, idx) => (
                <motion.div
                  key={reviewer.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                  className="flex items-start gap-3 p-4 bg-[#fafaf8] border border-[#e8e6e1] rounded-lg"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className="w-5 h-5 rounded bg-[#7a8450] flex items-center justify-center"
                    >
                      <span className="text-white text-xs">✓</span>
                    </motion.div>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-[#2d2d2a]">{reviewer.name}</div>
                    <div className="text-sm text-[#6b6b63] mt-0.5">{reviewer.reason}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Actions */}
      <AnimatePresence>
        {hasQuickActions && workspace.quick_actions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="glass-card p-6 border border-[#e8e6e1]"
          >
            <h3 className="text-xl font-semibold text-[#2d2d2a] mb-4 flex items-center gap-2">
              💡 Suggested Quick Actions
            </h3>
            <div className="space-y-2">
              {workspace.quick_actions.map((action, idx) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                  className="flex items-center gap-2 text-[#2d2d2a]"
                >
                  <span>{action.icon}</span>
                  <span className="text-sm">{action.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
