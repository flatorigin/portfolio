import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Container } from "../ui";
import ElectricalScopeBuilder from "../components/ElectricalScopeBuilder";
import { CategoryChips, excludedServices } from "../components/ElectricalServicePicker";
import { ELECTRICAL_PRICEBOOK_META, ELECTRICAL_PRICE_CATEGORIES, ELECTRICAL_SERVICES, findElectricalServices, formatPriceRange } from "../data/electricalPricing2026_27";

const roomServices = {
  kitchen: [["range", "induction", "120-circuit"], ["cabinet-lighting", "gfci-replace", "six-recessed"], ["kitchen-package"]],
  bathroom: [["bidet", "120-circuit"], ["bath-fan", "gfci-replace", "fixture-new"], ["bath-package"]],
  basement: [["sump", "120-circuit"], ["new-outlet", "six-recessed", "gfci-replace"], ["basement-package"]],
};
const inputClass = "h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400";
const actionClass = "rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50";

export default function ElectricalEstimator() {
  const { estimateId, shareToken } = useParams();
  const builder = useRef(null);
  const [query, setQuery] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const [category, setCategory] = useState("all");
  const [notice, setNotice] = useState("");
  const groups = useMemo(() => {
    if (!query.trim()) return [];
    const rooms = Object.keys(roomServices).filter(room => new RegExp(`\\b${room}\\b`, "i").test(query));
    if (rooms.length) return ["Dedicated Appliance & Circuit Needs", "Fixtures & Convenience", "Full Room Remodel Package"].map((title, index) => ({ title, items: [...new Set(rooms.flatMap(room => roomServices[room][index]))].map(id => ELECTRICAL_SERVICES.find(item => item.id === id)).filter(Boolean) }));
    return [{ title: "Suggested services", items: findElectricalServices(query, 6) }];
  }, [query]);
  const directory = ELECTRICAL_SERVICES.filter(item => (category === "all" || item.categoryId === category) && `${item.title} ${item.keywords} ${item.note}`.toLowerCase().includes(directorySearch.toLowerCase().trim()));
  function add(item) {
    if (builder.current?.addProject(item.id)) setNotice(`${item.title} added to your scope.`);
    else setNotice("Open or accept this estimate before adding services.");
  }
  function addButton(item) { return excludedServices.has(item.id) ? <span className="text-xs text-stone-500">Separate fee / reference</span> : <button type="button" onClick={() => add(item)} className={actionClass}>+ Add to Scope<span className="sr-only">: {item.title}</span></button>; }
  return <div className="min-h-screen bg-stone-50 pb-16 text-stone-900">
    <Container className="space-y-6 py-8 sm:py-10">
      <header>
        <Link to="/project-estimator" className="text-sm text-stone-500 hover:text-stone-900">← Project estimators</Link>
        <div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold sm:text-3xl">Residential electrical estimator</h1><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">{ELECTRICAL_PRICEBOOK_META.version}</span></div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">Plan electrical work for your home in Media & the Main Line. Add services, review the itemized starting price, and share your scope with an electrician.</p>
      </header>
      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="intent-heading">
        <h2 id="intent-heading" className="text-lg font-semibold">What electrical work do you need?</h2>
        <p className="mt-1 text-sm text-stone-600">Describe a problem or start with a room, such as kitchen, bathroom, or basement.</p>
        <label className="sr-only" htmlFor="electrical-question">What electrical work do you need?</label>
        <input id="electrical-question" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try kitchen, a tripping breaker, or an EV charger…" className={`${inputClass} mt-4`} />
        {groups.length > 0 && <div className="mt-5 space-y-5">{groups.map(group => <div key={group.title}><h3 className="text-sm font-semibold text-stone-700">{group.title}</h3><div className="mt-2 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{group.items.map(item => <article key={item.id} className="flex flex-col items-start rounded-xl border border-stone-200 p-4"><h4 className="text-sm font-semibold">{item.title}</h4><p className="mt-1 flex-1 text-xs leading-5 text-stone-600">{item.note}</p><div className="my-3 text-xs font-medium text-stone-700">{formatPriceRange(item.low, item.high, item.unit)}</div>{addButton(item)}</article>)}</div>{!group.items.length && <p className="mt-2 text-sm text-stone-500">No matching services. Try a device name or a room.</p>}</div>)}{groups.length > 1 && <p className="text-xs text-stone-500">Choose individual services or a full room package. Review overlaps before adding both.</p>}</div>}
        {notice && <p role="status" className="mt-3 text-sm text-stone-600">{notice} <a href="#scope-builder" className="underline">Review scope</a></p>}
      </section>
      <ElectricalScopeBuilder ref={builder} estimateId={estimateId} shareToken={shareToken} />
      <details className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <summary className="cursor-pointer p-5 text-sm font-semibold sm:p-6">Learn about residential electrical services & local pricing ranges (Media & Main Line, PA)</summary>
        <div className="space-y-4 border-t border-stone-200 p-5 sm:p-6">
          <label className="block"><span className="sr-only">Search pricing directory</span><input value={directorySearch} onChange={event => setDirectorySearch(event.target.value)} placeholder="Search the pricing directory…" className={inputClass} /></label>
          <CategoryChips value={category} onChange={setCategory} categories={[["all", "All"], ...ELECTRICAL_PRICE_CATEGORIES.map(group => [group.id, group.title])]} />
          <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500"><tr>{["Service Name & Scope Description", "Category", "Typical Range (Low – High)", "Unit", "Action"].map(title => <th key={title} className="px-3 py-3 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{directory.map(item => <tr key={item.id}><td className="max-w-sm px-3 py-3"><div className="font-medium">{item.title}</div><p className="mt-1 text-xs leading-5 text-stone-600">{item.note}</p></td><td className="px-3 py-3 text-xs text-stone-500">{item.categoryTitle}</td><td className="whitespace-nowrap px-3 py-3 text-xs font-medium">{item.display || formatPriceRange(item.low, item.high)}</td><td className="px-3 py-3 text-xs text-stone-500">per {item.unit}</td><td className="whitespace-nowrap px-3 py-3">{addButton(item)}</td></tr>)}</tbody></table></div>
          {!directory.length && <p className="text-sm text-stone-500">No services match these filters.</p>}
          <p className="text-xs leading-5 text-stone-500">Planning ranges assume ordinary access and compatible wiring. The electrician confirms the final scope and price. Permit and township charges remain separate.</p>
          <details className="text-xs text-stone-500"><summary className="cursor-pointer">Pricing sources and assumptions</summary><p className="mt-2">2026–27 planning data for {ELECTRICAL_PRICEBOOK_META.region}. These are estimates, not guaranteed minimum quotes.</p><div className="mt-2 space-y-1">{ELECTRICAL_PRICEBOOK_META.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block underline">{source.name}</a>)}</div></details>
        </div>
      </details>
    </Container>
  </div>;
}
