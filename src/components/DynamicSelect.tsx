// src/components/DynamicSelect.tsx
import { useState, useRef, useEffect } from "react";
import { Plus, X, ChevronDown, Check, Loader2 } from "lucide-react";
import { apiUrl } from "@/url";
import { toast } from "sonner";

interface DynamicSelectProps {
  schemaId: number;
  fieldKey: string;
  fieldLabel: string;
  options: string[];
  value: string;
  required?: boolean;
  onSelect: (val: string) => void;
  onOptionsUpdate: (newOptions: string[]) => void;
}

export const DynamicSelect = ({
  schemaId, fieldKey, fieldLabel, options,
  value, required, onSelect, onOptionsUpdate,
}: DynamicSelectProps) => {
  const [open, setOpen]         = useState(false);
  const [search, setSearch]     = useState("");
  const [adding, setAdding]     = useState(false);
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving]     = useState(false);

  const dropdownRef  = useRef<HTMLDivElement>(null);
  const addInputRef  = useRef<HTMLInputElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search when dropdown opens
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  // Focus add input when add mode opens
  useEffect(() => {
    if (adding && addInputRef.current) {
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [adding]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  // Save new option to DB
  const handleSaveNew = async () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;

    // Prevent duplicate
    if (options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`${apiUrl}/attribute-options`, {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ schema_id: schemaId, value: trimmed }),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.message || "Failed to add option");
        return;
      }

      const updated = [...options, trimmed];
      onOptionsUpdate(updated);  // update parent list immediately
      onSelect(trimmed);         // auto-select the new value
      setNewValue("");
      setAdding(false);
      setOpen(false);
      toast.success(`"${trimmed}" added to ${fieldLabel}`);
    } catch {
      toast.error("Network error — could not add option");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter")  { e.preventDefault(); handleSaveNew(); }
    if (e.key === "Escape") { setAdding(false); setNewValue(""); }
  };

  return (
    <div className="flex items-start gap-2">

      {/* ── Dropdown ── */}
      <div ref={dropdownRef} className="relative flex-1">

        {/* Trigger button */}
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setSearch(""); }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm bg-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            open ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <span className={value ? "text-gray-900" : "text-gray-400"}>
            {value || `Select ${fieldLabel}`}
          </span>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform duration-150 flex-shrink-0 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">

            {/* Search */}
            <div className="p-2 border-b border-gray-100">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${fieldLabel}…`}
                className="w-full text-sm px-2 py-1.5 rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            {/* Options list */}
            <div className="max-h-44 overflow-y-auto">
              {filtered.length > 0 ? (
                filtered.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { onSelect(opt); setOpen(false); setSearch(""); }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                      value === opt
                        ? "bg-blue-600 text-white font-medium"
                        : "text-gray-700 hover:bg-blue-50"
                    }`}
                  >
                    <span>{opt}</span>
                    {value === opt && <Check size={13} />}
                  </button>
                ))
              ) : (
                <div className="px-3 py-5 text-xs text-gray-400 text-center">
                  {search ? `No results for "${search}"` : "No options yet"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── + Button / Inline Add Input ── */}
      {adding ? (
        // Inline input mode — matches Image 3 in the screenshots
        <div className="flex items-center gap-1.5 flex-1">
          <input
            ref={addInputRef}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Add ${fieldLabel}…`}
            className="flex-1 text-sm px-3 py-2 rounded-md border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white shadow-sm"
          />
          {/* Confirm tick — matches Image 3 */}
          <button
            type="button"
            onClick={handleSaveNew}
            disabled={saving || !newValue.trim()}
            className="h-9 w-9 flex items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0"
            title="Save"
          >
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : <Check size={14} />
            }
          </button>
          {/* Cancel */}
          <button
            type="button"
            onClick={() => { setAdding(false); setNewValue(""); }}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors flex-shrink-0"
            title="Cancel"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        // + Button — matches Image 1 & 2
        <button
          type="button"
          onClick={() => { setAdding(true); setOpen(false); }}
          title={`Add new ${fieldLabel}`}
          className="h-9 w-9 flex items-center justify-center rounded-md border border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors flex-shrink-0 shadow-sm"
        >
          <Plus size={16} />
        </button>
      )}
    </div>
  );
};
