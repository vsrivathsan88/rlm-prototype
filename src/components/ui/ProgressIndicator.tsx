"use client";

interface ProgressIndicatorProps {
  /** Progress value from 0 to 100 */
  value: number;
  /** Current step description (plain language) */
  label?: string;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Estimated time remaining (optional) */
  timeRemaining?: string;
}

export function ProgressIndicator({
  value,
  label,
  showPercentage = true,
  timeRemaining
}: ProgressIndicatorProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className="w-full animate-slide-up">
      {(label || showPercentage || timeRemaining) && (
        <div className="progress-label">
          <span className="text-[var(--text-secondary)] font-medium">
            {label || "Working on it..."}
          </span>
          <span className="text-[var(--text-tertiary)] text-sm">
            {showPercentage && `${Math.round(clampedValue)}%`}
            {timeRemaining && ` • ${timeRemaining}`}
          </span>
        </div>
      )}
      <div className="progress-container">
        <div
          className="progress-bar"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

// Multi-step progress indicator for complex workflows
interface Step {
  label: string;
  status: "pending" | "active" | "complete";
}

interface MultiStepProgressProps {
  steps: Step[];
  currentStep: number;
}

export function MultiStepProgress({ steps, currentStep }: MultiStepProgressProps) {
  return (
    <div className="space-y-3 animate-fade-in">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isComplete = index < currentStep;
        const isPending = index > currentStep;

        return (
          <div
            key={index}
            className="flex items-center gap-3 animate-slide-in-right"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Step indicator */}
            <div
              className={`
                flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm transition-all
                ${isComplete ? 'bg-[var(--status-success)] text-white' : ''}
                ${isActive ? 'bg-[var(--brand-primary)] text-white' : ''}
                ${isPending ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]' : ''}
              `}
            >
              {isComplete ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                index + 1
              )}
            </div>

            {/* Step label */}
            <div className="flex-1">
              <div
                className={`
                  font-medium
                  ${isActive ? 'text-[var(--text-primary)]' : ''}
                  ${isComplete ? 'text-[var(--text-secondary)]' : ''}
                  ${isPending ? 'text-[var(--text-tertiary)]' : ''}
                `}
              >
                {step.label}
              </div>
              {isActive && (
                <div className="text-xs text-[var(--brand-primary)] mt-0.5">
                  In progress...
                </div>
              )}
            </div>

            {/* Pulsing dot for active step */}
            {isActive && (
              <div className="status-dot status-dot-working" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Skeleton loader for content that's loading
export function SkeletonLoader() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-[var(--bg-tertiary)] rounded w-3/4" />
      <div className="h-4 bg-[var(--bg-tertiary)] rounded w-full" />
      <div className="h-4 bg-[var(--bg-tertiary)] rounded w-5/6" />
    </div>
  );
}
