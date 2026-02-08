"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
}

export function WelcomeModal({ isOpen, onClose, projectName }: WelcomeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[var(--void)]/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-md mx-4 bg-[#ffffff] border border-[#e8e6e1] rounded-lg shadow-[0_8px_32px_rgba(45,45,42,0.12)] overflow-hidden"
      >
        {/* Header with gradient accent */}
        <div className="relative p-6 border-b border-[#e8e6e1]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8b7355] to-[#a0826d]" />
          <h2 className="text-2xl font-display font-semibold text-[#2d2d2a]">
            Welcome to Project Lens! ✨
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-[#2d2d2a] leading-relaxed">
            Your personalized workspace <span className="font-medium text-[#8b7355]">{projectName}</span> is ready.
          </p>

          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#8b7355]/10 flex items-center justify-center">
                <span className="text-sm">🤖</span>
              </div>
              <div>
                <p className="text-sm font-medium text-[#2d2d2a]">AI-Generated Content</p>
                <p className="text-sm text-[#6b6b63] mt-0.5">
                  Everything you see was created by AI based on your role and goals
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#8b7355]/10 flex items-center justify-center">
                <span className="text-sm">✏️</span>
              </div>
              <div>
                <p className="text-sm font-medium text-[#2d2d2a]">Everything is Editable</p>
                <p className="text-sm text-[#6b6b63] mt-0.5">
                  Click any field to customize it to your needs—no approval needed
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#8b7355]/10 flex items-center justify-center">
                <span className="text-sm">⌘</span>
              </div>
              <div>
                <p className="text-sm font-medium text-[#2d2d2a]">Command Panel</p>
                <p className="text-sm text-[#6b6b63] mt-0.5">
                  Press <kbd className="px-1.5 py-0.5 text-xs bg-[#f5f3f0] border border-[#e8e6e1] rounded">⌘K</kbd> anytime to get personalized suggestions
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#e8e6e1]">
            <p className="text-xs text-[#9a9a94]">
              💡 <span className="font-medium">Tip:</span> Start by connecting your files so AI reviewers can provide contextual feedback
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-[#fafaf8] border-t border-[#e8e6e1] flex justify-end gap-2">
          <Button
            variant="primary"
            onClick={onClose}
            className="bg-[#8b7355] hover:bg-[#7a6449] text-white"
          >
            Start Working →
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
