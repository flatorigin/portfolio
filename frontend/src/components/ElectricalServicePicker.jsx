import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ELECTRICAL_SERVICES } from "../data/electricalPricing2026_27";

export const quickCategories = [["all", "All"], ["devices", "Outlets & Switches"], ["circuits", "Circuits & 240V"], ["lighting", "Lighting"], ["service", "Panels"], ["equipment", "Appliances"], ["ev-backup", "EV & Backup"], ["rewiring", "Renovations"]];
export const excludedServices = new Set(["planned-estimate", "service-call", "hourly-electrician", "permit-handling", "media-permit", "lower-merion-permit"]);
export function CategoryChips({ value, onChange, categories = quickCategories }) {
  return <div className="flex flex-wrap gap-2" aria-label="Service categories">{categories.map(([id, title]) => <button type="button" key={id} aria-pressed={value === id} onClick={() => onChange(id)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${value === id ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-100"}`}>{title}</button>)}</div>;
}
export default function ElectricalServicePicker({ onAdd }) {
  const id = useId();
  const activeOption = useRef(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => ELECTRICAL_SERVICES.filter(item => !excludedServices.has(item.id) && (category === "all" || item.categoryId === category) && `${item.title} ${item.keywords}`.toLowerCase().includes(query.toLowerCase().trim())), [query, category]);
  useEffect(() => { if (open) activeOption.current?.scrollIntoView({ block: "nearest" }); }, [active, open]);
  function add(item) { onAdd(item.id); setOpen(false); setQuery(""); setActive(0); }
  return <div className="space-y-3" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id} className="block text-sm font-semibold text-stone-900">Add a homeowner project</label>
    <CategoryChips value={category} onChange={value => { setCategory(value); setActive(0); setOpen(true); }} />
    <div className="relative">
      <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-results`} aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined} value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }} onKeyDown={event => {
        if (event.key === "Escape") setOpen(false);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))); }
        if (event.key === "Enter" && open && matches[active]) { event.preventDefault(); add(matches[active]); }
      }} placeholder={`Search ${ELECTRICAL_SERVICES.length} services (e.g. 240V circuit, recessed light, EV charger)...`} className="h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400" />
      {open && <div id={`${id}-results`} role="listbox" aria-label="Matching services" className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg">{matches.length ? matches.map((item, index) => <div key={item.id} ref={index === active ? activeOption : null} id={`${id}-${index}`} role="option" aria-selected={index === active} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => add(item)} className={`cursor-pointer border-b border-stone-100 px-4 py-3 text-sm last:border-0 ${index === active ? "bg-stone-100" : "hover:bg-stone-50"}`}><div className="font-medium text-stone-900">{item.title}</div><div className="mt-1 text-xs text-stone-500">{item.categoryTitle} · Add to scope</div></div>) : <div className="p-4 text-sm text-stone-500">No services match. Try another term or category.</div>}</div>}
    </div>
    <p className="text-xs text-stone-500">Select a service to add its default scope. Visit charges are shared across projects; permits remain separate.</p>
  </div>;
}
