"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";

export function GlobalLoadingOverlay() {
  const activity = useAppStore((state) => state.globalActivity);

  const percent = useMemo(() => {
    if (!activity?.progressTotal || activity.progressTotal <= 0) return null;
    const raw = (activity.progressCurrent ?? 0) / activity.progressTotal;
    const clamped = Math.max(0, Math.min(1, raw));
    return Math.round(clamped * 100);
  }, [activity]);

  if (!activity) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#f8f5ef]/85 backdrop-blur-sm">
      <div className="w-[min(520px,92vw)] rounded-xl border border-[#e3dccf] bg-white px-6 py-5 shadow-[0_12px_42px_rgba(120,99,66,0.14)]">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#d8ccb8] border-t-[#8b7355]" />
          <div className="text-base font-medium text-[#342b21]">{activity.title}</div>
        </div>
        {activity.detail && <p className="mb-3 text-sm text-[#6d5a45]">{activity.detail}</p>}

        {percent != null && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-[#7a684f]">
              <span>
                {activity.progressCurrent ?? 0}/{activity.progressTotal}
              </span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#efe8db]">
              <div
                className="h-full rounded-full bg-[#8b7355] transition-all duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
