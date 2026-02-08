"use client";

interface KeyboardShortcutProps {
  keys: string[];
  className?: string;
}

export function KeyboardShortcut({ keys, className = "" }: KeyboardShortcutProps) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          className="
            inline-flex items-center justify-center
            min-w-[20px] h-5 px-1.5
            text-[10px] font-mono font-medium
            bg-[var(--graphite)] text-[var(--smoke)]
            border border-[var(--zinc)] border-b-2
            shadow-[0_1px_0_var(--slate)]
          "
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
