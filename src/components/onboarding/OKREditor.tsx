import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface KeyResult {
  metric: string;
  baseline: string;
  target: string;
  timeframe: string;
  description: string;
}

interface Objective {
  objective: string;
  key_results: KeyResult[];
}

interface OKREditorProps {
  okrs: Objective[];
  onChange: (okrs: Objective[]) => void;
}

export function OKREditor({ okrs, onChange }: OKREditorProps) {
  const [editingObjective, setEditingObjective] = useState<number | null>(null);
  const [editingKR, setEditingKR] = useState<{objIdx: number, krIdx: number} | null>(null);

  return (
    <div className="space-y-6">
      {okrs.map((obj, objIdx) => (
        <motion.div
          key={objIdx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          {/* Objective */}
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl">🎯</span>
            <div className="flex-1">
              {editingObjective === objIdx ? (
                <input
                  autoFocus
                  value={obj.objective}
                  onChange={(e) => {
                    const updated = [...okrs];
                    updated[objIdx].objective = e.target.value;
                    onChange(updated);
                  }}
                  onBlur={() => setEditingObjective(null)}
                  className="w-full px-3 py-2 bg-white border border-[#d4d2cc] rounded-md text-[#2d2d2a] focus:outline-none focus:border-[#9a9a94] focus:ring-2 focus:ring-[#9a9a94]/10"
                />
              ) : (
                <h3
                  onClick={() => setEditingObjective(objIdx)}
                  className="text-lg font-medium text-[#2d2d2a] cursor-pointer hover:text-[#8b7355] transition-colors"
                >
                  Objective {objIdx + 1}: {obj.objective}
                </h3>
              )}
            </div>
          </div>

          {/* Key Results */}
          <div className="space-y-3 ml-11">
            <p className="text-sm text-[#6b6b63] mb-2">Key Results:</p>
            {obj.key_results.map((kr, krIdx) => (
              <motion.div
                key={krIdx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3 p-3 bg-[#fafaf8] border border-[#e8e6e1] rounded-md hover:bg-white transition-colors"
              >
                <input
                  type="checkbox"
                  className="mt-1 accent-[#8b7355]"
                />
                <div className="flex-1">
                  {editingKR?.objIdx === objIdx && editingKR?.krIdx === krIdx ? (
                    <textarea
                      autoFocus
                      value={kr.description}
                      onChange={(e) => {
                        const updated = [...okrs];
                        updated[objIdx].key_results[krIdx].description = e.target.value;
                        onChange(updated);
                      }}
                      onBlur={() => setEditingKR(null)}
                      className="w-full px-3 py-2 bg-white border border-[#d4d2cc] rounded-md text-[#2d2d2a] resize-none focus:outline-none focus:border-[#9a9a94] focus:ring-2 focus:ring-[#9a9a94]/10"
                      rows={2}
                    />
                  ) : (
                    <p
                      onClick={() => setEditingKR({ objIdx, krIdx })}
                      className="text-sm text-[#2d2d2a] cursor-pointer hover:text-[#8b7355] transition-colors"
                    >
                      {kr.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    const updated = [...okrs];
                    updated[objIdx].key_results.splice(krIdx, 1);
                    onChange(updated);
                  }}
                  className="text-[#9a9a94] hover:text-[#6b6b63] text-xs transition-colors"
                >
                  ✕
                </button>
              </motion.div>
            ))}

            {/* Add Key Result */}
            <button
              onClick={() => {
                const updated = [...okrs];
                updated[objIdx].key_results.push({
                  metric: "New metric",
                  baseline: "X",
                  target: "Y",
                  timeframe: "Q4 2026",
                  description: "New Key Result - click to edit"
                });
                onChange(updated);
              }}
              className="text-sm text-[#6b6b63] hover:text-[#8b7355] transition-colors"
            >
              + Add Key Result
            </button>
          </div>
        </motion.div>
      ))}

      {/* Add Objective */}
      <button
        onClick={() => {
          onChange([...okrs, {
            objective: "New Objective",
            key_results: [{
              metric: "New metric",
              baseline: "X",
              target: "Y",
              timeframe: "Q4 2026",
              description: "New Key Result"
            }]
          }]);
        }}
        className="w-full py-3 border-2 border-dashed border-[#d4d2cc] rounded-lg text-[#6b6b63] hover:text-[#8b7355] hover:border-[#8b7355] transition-all"
      >
        + Add Objective
      </button>
    </div>
  );
}
