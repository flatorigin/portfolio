import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button, Container, Input, SymbolIcon } from "../ui";
import ElectricalScopeBuilder from "../components/ElectricalScopeBuilder";
import {
  ELECTRICAL_PRICEBOOK_META,
  ELECTRICAL_PRICE_CATEGORIES,
  ELECTRICAL_SERVICES,
  estimateEvCharger,
  findElectricalServices,
  formatPriceRange,
} from "../data/electricalPricing2026_27";

const money = value => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
}).format(Number(value || 0));

function SelectField({ label, value, onChange, children, help }) {
  return <label className="block text-sm text-slate-700">
    <span className="mb-1.5 block font-semibold text-slate-900">{label}</span>
    <select value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
      {children}
    </select>
    {help && <span className="mt-1.5 block text-xs leading-5 text-slate-500">{help}</span>}
  </label>;
}

function PricePill({ item }) {
  return <span className="inline-flex shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-950 ring-1 ring-inset ring-amber-200">
    {item.display || formatPriceRange(item.low, item.high, item.unit)}
  </span>;
}

function ServiceResult({ item, compact = false }) {
  return <article className={`rounded-xl border border-slate-200 bg-white ${compact ? "p-4" : "p-5"}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.categoryTitle}</div>
        <h3 className="mt-1 text-base font-bold text-slate-950">{item.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
      </div>
      <PricePill item={item} />
    </div>
  </article>;
}

export default function ElectricalEstimator() {
  const { estimateId, shareToken } = useParams();
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState("");
  const [matches, setMatches] = useState([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [category, setCategory] = useState("all");
  const [ev, setEv] = useState({
    distance: 30,
    route: "open",
    panel: "ready",
    connection: "hardwired",
    detached: false,
    includeCharger: false,
  });
  const evEstimate = useMemo(() => estimateEvCharger(ev), [ev]);
  const directory = useMemo(() => {
    const query = directorySearch.trim().toLowerCase();
    return ELECTRICAL_PRICE_CATEGORIES.map(group => ({
      ...group,
      services: group.services.filter(item => {
        const inCategory = category === "all" || category === group.id;
        const inSearch = !query || `${item.title} ${item.keywords} ${item.note}`.toLowerCase().includes(query);
        return inCategory && inSearch;
      }),
    })).filter(group => group.services.length);
  }, [directorySearch, category]);

  function ask(event) {
    event.preventDefault();
    const clean = question.trim();
    setAskedQuestion(clean);
    setMatches(findElectricalServices(clean));
  }

  const setExample = value => {
    setQuestion(value);
    setAskedQuestion(value);
    setMatches(findElectricalServices(value));
  };
  const updateEv = (key, value) => setEv(current => ({ ...current, [key]: value }));

  return <div className="min-h-screen bg-[#F7F5F0] pb-20 text-slate-900">
    <header className="border-b border-slate-200 bg-slate-950 text-white">
      <Container className="py-9 sm:py-14">
        <Link to="/project-estimator" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300 hover:text-white">
          <SymbolIcon name="arrow_back" className="text-[17px]" />Project estimators
        </Link>
        <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950">{ELECTRICAL_PRICEBOOK_META.version} price book</span>
              <span className="text-xs text-slate-300">{ELECTRICAL_SERVICES.length} common residential services</span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">Understand an electrician’s price before the visit.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Describe the problem in your own words, browse common work, or estimate a Level 2 car-charger run from the breaker panel to your garage.</p>
          </div>
          <nav aria-label="Electrical pricing sections" className="flex flex-wrap gap-2 text-sm font-semibold">
            <a href="#scope-builder" className="rounded-xl bg-amber-400 px-4 py-2.5 text-slate-950 hover:bg-amber-300">Build a scope</a>
            <a href="#ask" className="rounded-xl border border-slate-700 px-4 py-2.5 hover:bg-slate-800">Ask about a price</a>
            <a href="#ev-charger" className="rounded-xl border border-slate-700 px-4 py-2.5 hover:bg-slate-800">EV charger estimate</a>
          </nav>
        </div>
      </Container>
    </header>

    <Container className="space-y-8 py-8">
      <ElectricalScopeBuilder estimateId={estimateId} shareToken={shareToken} />
      <section id="ask" className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-950"><SymbolIcon name="forum" className="text-[24px]" /></span>
            <div><h2 className="text-xl font-bold text-slate-950 sm:text-2xl">What electrical work do you need?</h2><p className="mt-1 text-sm leading-6 text-slate-600">Use homeowner language. The guide matches your words to likely electrician services and shows the local planning range.</p></div>
          </div>
          <form onSubmit={ask} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="electrical-question">Ask an electrical pricing question</label>
            <Input id="electrical-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Example: My breaker keeps tripping when I use the microwave" className="min-h-12 flex-1 text-base" />
            <Button type="submit" className="min-h-12 gap-2 bg-amber-400 px-5 font-bold text-slate-950 hover:bg-amber-300">
              <SymbolIcon name="search" className="text-[20px]" />Find the likely price
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {["I need a Tesla charger in my garage", "My breaker keeps tripping", "Replace my old Federal Pacific panel", "Add six recessed lights"].map(example => <button key={example} type="button" onClick={() => setExample(example)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-950">{example}</button>)}
          </div>
        </div>
        {askedQuestion && <div className="bg-slate-50 p-5 sm:p-7" aria-live="polite">
          {matches.length ? <>
            <div className="mb-4"><div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Likely matches</div><p className="mt-1 text-sm text-slate-700">For “{askedQuestion},” start with these services. A site visit confirms which one applies.</p></div>
            <div className="grid gap-3 lg:grid-cols-2">{matches.map(item => <ServiceResult key={item.id} item={item} compact />)}</div>
            {matches.some(item => item.id.startsWith("ev-")) && <a href="#ev-charger" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-amber-900 hover:text-amber-700">Build the garage charger estimate <SymbolIcon name="arrow_downward" className="text-[18px]" /></a>}
          </> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>No confident match yet.</strong> Try naming the device and symptom, such as “dead kitchen outlet,” “new ceiling fan,” or “200-amp panel upgrade.”</div>}
        </div>}
      </section>

      <section id="ev-charger" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><SymbolIcon name="ev_station" className="text-[25px]" /></span>
            <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Panel to garage</div><h2 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">Level 2 car-charger estimator</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Includes a two-pole breaker, correctly sized wiring, ordinary conduit or cable, charger mounting, connections, testing, and labor. Permit and township costs stay separate.</p></div>
          </div>
          <div className="rounded-xl bg-slate-950 px-5 py-4 text-white sm:text-right">
            <div className="text-xs text-slate-300">Expected project range</div>
            <div className="mt-1 text-2xl font-bold text-amber-300">{money(evEstimate.low)}–{money(evEstimate.high)}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm text-slate-700"><span className="mb-1.5 block font-semibold text-slate-900">Panel-to-charger distance</span><div className="relative"><Input type="number" min="0" max="300" step="1" value={ev.distance} onChange={event => updateEv("distance", event.target.value)} className="h-11 pr-12" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">feet</span></div><span className="mt-1.5 block text-xs leading-5 text-slate-500">Measure the practical wire path, including vertical travel.</span></label>
            <SelectField label="Wire route" value={ev.route} onChange={value => updateEv("route", value)}>
              <option value="open">Open basement, garage or unfinished space</option>
              <option value="finished">Finished walls or ceilings</option>
              <option value="exterior">Exterior conduit</option>
              <option value="trench">Underground trench and conduit</option>
            </SelectField>
            <SelectField label="Existing panel condition" value={ev.panel} onChange={value => updateEv("panel", value)} help="A licensed electrician must confirm capacity with a load calculation.">
              <option value="ready">Enough capacity and breaker space</option>
              <option value="space">Capacity available, but panel space is tight</option>
              <option value="managed">Needs load-management equipment</option>
              <option value="upgrade">Needs a 100A-to-200A service upgrade</option>
              <option value="unknown">I do not know</option>
            </SelectField>
            <SelectField label="Charger connection" value={ev.connection} onChange={value => updateEv("connection", value)}>
              <option value="hardwired">Hardwired charger</option>
              <option value="receptacle">NEMA 14-50 receptacle</option>
            </SelectField>
            <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-900">Project options</legend>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={ev.detached} onChange={event => updateEv("detached", event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600" /><span>Charger is in a detached garage</span></label>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700"><input type="checkbox" checked={ev.includeCharger} onChange={event => updateEv("includeCharger", event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600" /><span>Include Level 2 charger equipment</span></label>
            </fieldset>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="font-bold text-slate-950">What builds the estimate</h3>
            <div className="mt-4 space-y-3">{evEstimate.breakdown.map((line, index) => <div key={`${line.label}-${index}`} className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 text-sm last:border-0 last:pb-0"><span className="leading-5 text-slate-600">{line.label}</span><strong className="shrink-0 text-slate-950">{money(line.low)}–{money(line.high)}</strong></div>)}</div>
            {evEstimate.needsLoadCheck && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Panel capacity is still unknown.</strong> This range assumes the existing panel can accept the charger. A load-management device or service upgrade would be added if required.</div>}
            <div className="mt-5 text-xs leading-5 text-slate-500">The estimate excludes permits, township fees, filing or coordination work, drywall and paint repair, unusual utility work, asbestos remediation, driveway restoration, and hidden electrical defects.</div>
          </aside>
        </div>
      </section>

      <section aria-labelledby="directory-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Stored pricing data</div><h2 id="directory-title" className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">Residential electrical pricing directory</h2><p className="mt-1 text-sm leading-6 text-slate-600">Typical planning ranges for {ELECTRICAL_PRICEBOOK_META.region}. Prices are contractor totals unless a line says otherwise.</p></div>
          <div className="text-xs text-slate-500">Effective through {new Date(`${ELECTRICAL_PRICEBOOK_META.effectiveThrough}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_280px]">
          <label><span className="sr-only">Search electrical services</span><Input value={directorySearch} onChange={event => setDirectorySearch(event.target.value)} placeholder="Search outlets, panels, lighting, rewiring…" className="h-11" /></label>
          <label><span className="sr-only">Filter category</span><select value={category} onChange={event => setCategory(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"><option value="all">All categories</option>{ELECTRICAL_PRICE_CATEGORIES.map(group => <option key={group.id} value={group.id}>{group.title}</option>)}</select></label>
        </div>
        <div className="mt-7 space-y-8">{directory.map(group => <section key={group.id}>
          <div className="mb-3 flex items-center gap-2"><SymbolIcon name={group.icon} className="text-[21px] text-slate-500" /><h3 className="text-lg font-bold text-slate-950">{group.title}</h3><span className="text-xs text-slate-400">{group.services.length}</span></div>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">{group.services.map(item => <div key={item.id} className="grid gap-2 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-5"><div><div className="font-semibold text-slate-900">{item.title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{item.note}</div></div><PricePill item={item} /></div>)}</div>
        </section>)}</div>
        {!directory.length && <div className="mt-7 rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">No directory entries match that search.</div>}
      </section>

      <section className="rounded-2xl bg-slate-900 p-5 text-slate-200 sm:p-7">
        <h2 className="font-bold text-white">How to use these numbers</h2>
        <p className="mt-2 text-sm leading-6">Use the range to plan and compare complete scopes. The lower end assumes clear access and compatible existing wiring. Finished plaster, masonry, long runs, occupied rooms, older panels, emergency scheduling, or discovered code problems move work toward or beyond the upper end. The electrician’s written proposal controls the actual price.</p>
        <details className="mt-4 text-sm text-slate-300"><summary className="cursor-pointer font-semibold text-white">Pricing sources and update basis</summary><p className="mt-2 leading-6">The regional guide combines current municipal fees with published 2026 consumer cost data, then uses higher local planning bands for Media and the Main Line.</p><div className="mt-2 flex flex-col gap-1.5">{ELECTRICAL_PRICEBOOK_META.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="w-fit text-amber-300 underline decoration-amber-300/50 underline-offset-2 hover:text-amber-200">{source.name}</a>)}</div></details>
      </section>
    </Container>
  </div>;
}
