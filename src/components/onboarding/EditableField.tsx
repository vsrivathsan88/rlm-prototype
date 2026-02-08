"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface EditableFieldProps {
  type: "text" | "textarea" | "list";
  label: string;
  value: string | string[];
  icon?: string;
  placeholder?: string;
  helpText?: string;
  onChange: (value: any) => void;
  maxItems?: number;
}

export function EditableTextField({ label, value, icon, placeholder, helpText, onChange }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    onChange(localValue);
    setEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className="group relative py-3">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-lg">{icon}</span>}
        <label className="text-sm font-medium text-[#2d2d2a]">{label}</label>
      </div>

      {editing ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder={placeholder}
            className="w-full bg-white border border-[#d4d2cc] rounded-lg px-4 py-2 text-[#2d2d2a] focus:border-[#9a9a94] focus:outline-none focus:ring-2 focus:ring-[#9a9a94]/10 transition-all"
          />
          {helpText && <p className="text-xs text-[#6b6b63]">{helpText}</p>}
        </motion.div>
      ) : (
        <motion.div
          whileHover={{ y: -1 }}
          onClick={() => setEditing(true)}
          className="cursor-pointer bg-[#fafaf8] border border-[#e8e6e1] hover:border-[#d4d2cc] rounded-lg px-4 py-2 transition-all group-hover:shadow-[0_2px_4px_rgba(45,45,42,0.06)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[#2d2d2a]">{value || placeholder}</span>
            <span className="opacity-0 group-hover:opacity-100 text-[#8b7355] text-sm transition-opacity">
              Click to edit
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function EditableTextareaField({ label, value, icon, placeholder, helpText, onChange }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  const handleSave = () => {
    onChange(localValue);
    setEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
    setEditing(false);
  };

  return (
    <div className="group relative py-3">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-lg">{icon}</span>}
        <label className="text-sm font-medium text-[#2d2d2a]">{label}</label>
      </div>

      {editing ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleSave}
            placeholder={placeholder}
            rows={3}
            className="w-full bg-white border border-[#d4d2cc] rounded-lg px-4 py-2 text-[#2d2d2a] focus:border-[#9a9a94] focus:outline-none focus:ring-2 focus:ring-[#9a9a94]/10 transition-all resize-none"
          />
          <div className="flex items-center justify-between">
            {helpText && <p className="text-xs text-[#6b6b63]">{helpText}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="text-xs px-3 py-1 bg-[#8b7355] text-white rounded-md hover:bg-[#a0826d] transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="text-xs px-3 py-1 border border-[#d4d2cc] text-[#2d2d2a] rounded-md hover:bg-[#fafaf8] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          whileHover={{ y: -1 }}
          onClick={() => setEditing(true)}
          className="cursor-pointer bg-[#fafaf8] border border-[#e8e6e1] hover:border-[#d4d2cc] rounded-lg px-4 py-3 transition-all group-hover:shadow-[0_2px_4px_rgba(45,45,42,0.06)]"
        >
          <div className="flex items-start justify-between gap-4">
            <p className="text-[#2d2d2a] text-sm leading-relaxed whitespace-pre-wrap flex-1">
              {value || <span className="text-[#9a9a94] italic">{placeholder}</span>}
            </p>
            <span className="opacity-0 group-hover:opacity-100 text-[#8b7355] text-xs shrink-0 transition-opacity">
              Click to edit
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function EditableListField({ label, value, icon, placeholder, helpText, onChange, maxItems = 5 }: EditableFieldProps) {
  const items = Array.isArray(value) ? value : [];
  const [newItem, setNewItem] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addItem = () => {
    if (newItem.trim() && items.length < maxItems) {
      onChange([...items, newItem.trim()]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(items[index]);
  };

  const saveEdit = (index: number) => {
    if (editingValue.trim()) {
      const updated = [...items];
      updated[index] = editingValue.trim();
      onChange(updated);
    }
    setEditingIndex(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="group relative py-3">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-lg">{icon}</span>}
        <label className="text-sm font-medium text-[#2d2d2a]">{label}</label>
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
              className="group/item flex items-start gap-2 bg-[#fafaf8] border border-[#e8e6e1] rounded-lg px-3 py-2 hover:border-[#d4d2cc] transition-colors"
            >
              <span className="text-[#9a9a94] text-sm shrink-0 mt-0.5">{index + 1}.</span>

              {editingIndex === index ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, () => saveEdit(index))}
                  onBlur={() => saveEdit(index)}
                  autoFocus
                  className="flex-1 bg-transparent text-[#2d2d2a] text-sm focus:outline-none"
                />
              ) : (
                <span
                  onClick={() => startEdit(index)}
                  className="flex-1 text-[#2d2d2a] text-sm cursor-pointer hover:text-[#8b7355] transition-colors"
                >
                  {item}
                </span>
              )}

              <button
                onClick={() => removeItem(index)}
                className="opacity-0 group-hover/item:opacity-100 text-[#9a9a94] hover:text-[#a0826d] text-xs transition-all"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length < maxItems && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, addItem)}
              placeholder={placeholder || "Add item..."}
              className="flex-1 bg-white border border-dashed border-[#d4d2cc] rounded-lg px-3 py-2 text-[#2d2d2a] text-sm placeholder:text-[#9a9a94] focus:border-[#9a9a94] focus:border-solid focus:outline-none transition-all"
            />
            <button
              onClick={addItem}
              disabled={!newItem.trim()}
              className="px-4 py-2 bg-[#8b7355] text-white text-sm rounded-lg hover:bg-[#a0826d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              + Add
            </button>
          </motion.div>
        )}

        {helpText && <p className="text-xs text-[#6b6b63] mt-1">{helpText}</p>}
      </div>
    </div>
  );
}
