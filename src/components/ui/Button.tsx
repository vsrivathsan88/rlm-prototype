"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-[var(--brand-primary)] text-white font-medium rounded-lg border border-[#8a6d44]
    hover:bg-[#7a6340] hover:shadow-md hover:-translate-y-0.5
    active:bg-[#695537]
    disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)]
  `,
  secondary: `
    bg-[var(--deck-frost-strong)] text-[var(--text-primary)] border border-[var(--deck-edge)] rounded-lg font-medium
    hover:bg-[var(--bg-hover)] hover:border-[var(--deck-edge-strong)]
    active:bg-[var(--bg-tertiary)]
    disabled:bg-[var(--bg-secondary)] disabled:text-[var(--text-tertiary)] disabled:border-[var(--border-light)]
  `,
  ghost: `
    bg-transparent text-[var(--text-secondary)] rounded-lg
    hover:bg-[var(--deck-frost)] hover:text-[var(--text-primary)]
    active:bg-[var(--bg-hover)]
    disabled:text-[var(--text-tertiary)]
  `,
  danger: `
    bg-[var(--status-error)] text-white font-medium rounded-lg
    hover:bg-[#dc2626] hover:shadow-md hover:-translate-y-0.5
    active:bg-[#b91c1c]
    disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)]
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-base gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", isLoading, className = "", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          inline-flex items-center justify-center
          transition-all duration-200 ease-out
          focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:ring-opacity-30
          disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-0.5 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
