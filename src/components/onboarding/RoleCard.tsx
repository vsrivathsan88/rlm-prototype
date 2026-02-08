import { motion } from "framer-motion";
import { RoleIcon } from "./RoleIcon";

interface RoleCardProps {
  roleId: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

export function RoleCard({ roleId, title, description, selected, onClick }: RoleCardProps) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      data-testid={`role-card-${roleId}`}
      aria-pressed={selected}
      className={`
        relative cursor-pointer
        w-full text-left
        p-6 rounded-lg
        transition-all duration-300
        ${selected
          ? "bg-white border-2 border-[#8b7355] shadow-[0_4px_16px_rgba(45,45,42,0.1)]"
          : "bg-white border border-[#e8e6e1] shadow-[0_2px_4px_rgba(45,45,42,0.04),0_4px_12px_rgba(45,45,42,0.06)] hover:border-[#d4d2cc] hover:shadow-[0_4px_16px_rgba(45,45,42,0.1)]"
        }
      `}
    >
      {/* Icon */}
      <div className="mb-4">
        <RoleIcon role={roleId} />
      </div>

      {/* Title */}
      <h3 className="text-base font-medium text-[#2d2d2a] mb-2 leading-snug">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-[#6b6b63] leading-relaxed">
        {description}
      </p>
    </motion.button>
  );
}
