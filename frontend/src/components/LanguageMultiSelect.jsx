import { useEffect, useRef, useState } from "react";
import { SymbolIcon } from "../ui";

const DEFAULT_OPTIONS = [
  "English",
  "Spanish",
  "French",
  "Arabic",
  "Persian",
  "Portuguese",
  "Chinese",
  "Hindi",
  "Urdu",
  "Russian",
  "German",
  "Italian",
  "Turkish",
  "Korean",
  "Japanese",
];

export default function LanguageMultiSelect({
  value = [],
  onChange,
  options = DEFAULT_OPTIONS,
  label = "Languages",
  placeholder = "Select languages",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = Array.isArray(value) ? value : [];

  const toggleValue = (lang) => {
    const exists = selected.includes(lang);
    const next = exists
      ? selected.filter((x) => x !== lang)
      : [...selected, lang];
    onChange?.(next);
  };

  const summary = selected.length > 0 ? selected.join(", ") : placeholder;

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm hover:bg-slate-50"
      >
        <span className={selected.length ? "text-slate-900" : "text-slate-400"}>
          {summary}
        </span>
        <SymbolIcon name="keyboard_arrow_down" className="ml-3 text-[20px] text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="max-h-72 overflow-auto py-1">
            {options.map((lang) => {
              const checked = selected.includes(lang);

              return (
                <label
                  key={lang}
                  className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50"
                >
                  <span className="text-sm text-slate-800">{lang}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(lang)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </label>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 px-2 pt-2">
            <button
              type="button"
              onClick={() => onChange?.([])}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
