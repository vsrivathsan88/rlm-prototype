"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Option {
  value: string;
  label: string;
}

interface QuestionFieldProps {
  label: string;
  icon?: string;
  helpText?: string;
  options?: Option[];
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
}

export function MultiSelectField({ label, icon, helpText, options = [], value = [], onChange }: QuestionFieldProps) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (optionValue: string) => {
    if (selected.includes(optionValue)) {
      onChange(selected.filter(v => v !== optionValue));
    } else {
      onChange([...selected, optionValue]);
    }
  };

  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-xl">{icon}</span>}
        <label className="text-base font-medium text-[#2d2d2a]">{label}</label>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <motion.button
              key={option.value}
              onClick={() => toggle(option.value)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative px-4 py-3 rounded-lg text-left transition-all
                ${isSelected
                  ? "bg-white border-2 border-[#8b7355] shadow-[0_2px_8px_rgba(139,115,85,0.1)]"
                  : "bg-white border border-[#e8e6e1] hover:border-[#d4d2cc] shadow-[0_1px_2px_rgba(45,45,42,0.06)]"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                  ${isSelected ? "bg-[#8b7355] border-[#8b7355]" : "bg-white border-[#d4d2cc]"}
                `}>
                  {isSelected && (
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-3 h-3 text-white"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </motion.svg>
                  )}
                </div>
                <span className="text-sm font-medium text-[#2d2d2a]">{option.label}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {helpText && (
        <p className="text-xs text-[#6b6b63] pl-1">{helpText}</p>
      )}
    </div>
  );
}

export function ChipsField({ label, icon, helpText, options = [], value = [], onChange }: QuestionFieldProps) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (optionValue: string) => {
    if (selected.includes(optionValue)) {
      onChange(selected.filter(v => v !== optionValue));
    } else {
      onChange([...selected, optionValue]);
    }
  };

  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-xl">{icon}</span>}
        <label className="text-base font-medium text-[#2d2d2a]">{label}</label>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <motion.button
              key={option.value}
              onClick={() => toggle(option.value)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all
                ${isSelected
                  ? "bg-[#8b7355] text-white shadow-[0_2px_4px_rgba(139,115,85,0.2)]"
                  : "bg-white text-[#2d2d2a] border border-[#e8e6e1] hover:border-[#d4d2cc]"
                }
              `}
            >
              {option.label}
            </motion.button>
          );
        })}
      </div>

      {helpText && (
        <p className="text-xs text-[#6b6b63] pl-1">{helpText}</p>
      )}
    </div>
  );
}

export function SelectField({ label, icon, helpText, options = [], value, onChange }: QuestionFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="space-y-3 py-4 relative">
      <div className="flex items-center gap-2">
        {icon && <span className="text-xl">{icon}</span>}
        <label className="text-base font-medium text-[#2d2d2a]">{label}</label>
      </div>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 bg-white border border-[#d4d2cc] rounded-lg text-left hover:border-[#9a9a94] transition-colors flex items-center justify-between"
        >
          <span className={selectedOption ? "text-[#2d2d2a]" : "text-[#9a9a94]"}>
            {selectedOption?.label || "Select an option..."}
          </span>
          <motion.svg
            animate={{ rotate: isOpen ? 180 : 0 }}
            className="w-5 h-5 text-[#9a9a94]"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </motion.svg>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute z-10 w-full mt-2 bg-white border border-[#d4d2cc] rounded-lg shadow-[0_8px_24px_rgba(45,45,42,0.12)] overflow-hidden"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full px-4 py-3 text-left text-sm transition-colors
                    ${option.value === value
                      ? "bg-[#8b7355] text-white"
                      : "text-[#2d2d2a] hover:bg-[#fafaf8]"
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {helpText && (
        <p className="text-xs text-[#6b6b63] pl-1">{helpText}</p>
      )}
    </div>
  );
}

export function TextInputField({ label, icon, helpText, value = "", onChange, placeholder }: QuestionFieldProps) {
  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-xl">{icon}</span>}
        <label className="text-base font-medium text-[#2d2d2a]">{label}</label>
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-white border border-[#d4d2cc] rounded-lg text-[#2d2d2a] placeholder:text-[#9a9a94] focus:border-[#9a9a94] focus:outline-none focus:ring-2 focus:ring-[#9a9a94]/10 transition-all"
      />

      {helpText && (
        <p className="text-xs text-[#6b6b63] pl-1">{helpText}</p>
      )}
    </div>
  );
}

export function TextareaInputField({ label, icon, helpText, value = "", onChange, placeholder }: QuestionFieldProps) {
  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-xl">{icon}</span>}
        <label className="text-base font-medium text-[#2d2d2a]">{label}</label>
      </div>

      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full px-4 py-3 bg-white border border-[#d4d2cc] rounded-lg text-[#2d2d2a] placeholder:text-[#9a9a94] focus:border-[#9a9a94] focus:outline-none focus:ring-2 focus:ring-[#9a9a94]/10 transition-all resize-none"
      />

      {helpText && (
        <p className="text-xs text-[#6b6b63] pl-1">{helpText}</p>
      )}
    </div>
  );
}

export function ListInputField({ label, icon, helpText, value = [], onChange, placeholder, maxItems = 10 }: QuestionFieldProps & { maxItems?: number }) {
  const items = Array.isArray(value) ? value : [];
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    if (newItem.trim() && items.length < maxItems) {
      onChange([...items, newItem.trim()]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-xl">{icon}</span>}
        <label className="text-base font-medium text-[#2d2d2a]">{label}</label>
        <span className="text-xs text-[#9a9a94] ml-auto">
          {items.length}/{maxItems}
        </span>
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="group flex items-center gap-2 bg-[#fafaf8] border border-[#e8e6e1] rounded-lg px-3 py-2"
            >
              <span className="text-[#9a9a94] text-sm shrink-0">{index + 1}.</span>
              <span className="flex-1 text-[#2d2d2a] text-sm">{item}</span>
              <button
                onClick={() => removeItem(index)}
                className="opacity-0 group-hover:opacity-100 text-[#9a9a94] hover:text-[#a0826d] text-sm transition-all"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length < maxItems && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder={placeholder}
              className="flex-1 px-4 py-2 bg-white border-2 border-dashed border-[#d4d2cc] rounded-lg text-[#2d2d2a] placeholder:text-[#9a9a94] focus:border-[#9a9a94] focus:border-solid focus:outline-none transition-all"
            />
            <button
              onClick={addItem}
              disabled={!newItem.trim()}
              className="px-4 py-2 bg-[#8b7355] text-white text-sm rounded-lg hover:bg-[#a0826d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              + Add
            </button>
          </div>
        )}
      </div>

      {helpText && (
        <p className="text-xs text-[#6b6b63] pl-1 mt-1">{helpText}</p>
      )}
    </div>
  );
}
