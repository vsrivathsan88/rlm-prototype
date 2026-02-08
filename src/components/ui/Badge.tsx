"use client";

type BadgeVariant = "default" | "phosphor" | "amber" | "coral" | "cyan";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--graphite)] text-[var(--silver)] border-[var(--zinc)]",
  phosphor: "bg-[var(--phosphor-glow)] text-[var(--phosphor)] border-[var(--phosphor)]/30",
  amber: "bg-[var(--amber-glow)] text-[var(--amber)] border-[var(--amber)]/30",
  coral: "bg-[var(--coral-glow)] text-[var(--coral)] border-[var(--coral)]/30",
  cyan: "bg-[var(--cyan-glow)] text-[var(--cyan)] border-[var(--cyan)]/30",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center
        px-2 py-0.5
        text-[10px] font-mono uppercase tracking-wider
        border
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
