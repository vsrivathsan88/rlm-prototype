// Minimalist geometric icons for each role
// Wabi-sabi inspired - simple, organic shapes

interface RoleIconProps {
  role: string;
  className?: string;
}

export function RoleIcon({ role, className = "w-12 h-12" }: RoleIconProps) {
  const icons: Record<string, React.ReactNode> = {
    product_marketing_manager: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <path
          d="M24 8L40 16L24 24L8 16L24 8Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M8 24L24 32L40 24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 32L24 40L40 32"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    content_marketing_manager: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <path
          d="M12 12H36V36H12V12Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 20H30M18 24H30M18 28H26"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    demand_gen_manager: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <path
          d="M8 36L16 28L24 32L40 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="28" r="2" fill="currentColor" />
        <circle cx="24" cy="32" r="2" fill="currentColor" />
        <circle cx="40" cy="16" r="2" fill="currentColor" />
      </svg>
    ),
    account_executive: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <circle
          cx="24"
          cy="24"
          r="12"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="24" cy="24" r="4" fill="currentColor" />
        <path
          d="M24 12V8M24 40V36M36 24H40M8 24H12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    customer_success_manager: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <path
          d="M24 38C31.732 38 38 31.732 38 24C38 16.268 31.732 10 24 10C16.268 10 10 16.268 10 24C10 31.732 16.268 38 24 38Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M16 24L22 30L32 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    sales_enablement_manager: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <path
          d="M12 12H28L36 20V36H12V12Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M28 12V20H36"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M18 24H30M18 28H30"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    growth_marketing_manager: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <path
          d="M24 8L24 40"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M24 16L16 24L24 32L32 24L24 16Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="currentColor"
          opacity="0.2"
        />
      </svg>
    ),
    partner_marketing_manager: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <circle cx="18" cy="24" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="30" cy="24" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <path
          d="M24 20L24 28"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    field_marketing_manager: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <circle
          cx="24"
          cy="24"
          r="14"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="24" cy="24" r="2" fill="currentColor" />
      </svg>
    ),
    brand_manager: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <path
          d="M24 8L32 16L24 24L16 16L24 8Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M16 24L24 32L32 24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 32L24 40L36 32"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    communications_manager: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <path
          d="M10 18C10 14.686 12.686 12 16 12H32C35.314 12 38 14.686 38 18V28C38 31.314 35.314 34 32 34H20L10 40V18Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M18 22H30M18 26H26"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    solutions_engineer: (
      <svg className={className} viewBox="0 0 48 48" fill="none">
        <rect
          x="12"
          y="12"
          width="24"
          height="24"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M20 20L28 28M28 20L20 28"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  };

  return (
    <div className="text-[#8b7355]">
      {icons[role] || icons.product_marketing_manager}
    </div>
  );
}
