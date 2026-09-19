import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import api from "../api";
import {
  calculatePaintingEstimate,
  createDefaultPaintingInputs,
  createPaintingSection,
  normalizePaintingInputsForEditor,
} from "../estimators/painting";
import { Button, Container, Input, SymbolIcon, Textarea } from "../ui";


const PENDING_ESTIMATE_KEY = "flatorigin:pending-painting-estimate";


function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}


function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}


function createDraft() {
  return {
    status: "draft",
    project_name: "Interior painting estimate",
    issue_date: localDateString(),
    valid_until: dateAfter(30),
    inputs: createDefaultPaintingInputs(),
  };
}


function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}


function readableDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}


function FieldLabel({ children }) {
  return <div className="mb-1.5 text-sm font-medium text-slate-700">{children}</div>;
}


function Select({ className = "", ...props }) {
  return <select {...props} className={`h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`} />;
}


function ToggleChoice({ checked, onChange, label, description }) {
  return (
    <label className={[
      "flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition",
      checked ? "border-slate-500 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300",
    ].join(" ")}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-slate-900" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </label>
  );
}


function SectionHeading({ title, description, open, onToggle, trailing }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <SymbolIcon name={open ? "expand_less" : "expand_more"} className="mt-0.5 text-[22px] text-slate-500" />
        <span className="min-w-0">
          <span className="block text-lg font-bold text-slate-950">{title}</span>
          {description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}
        </span>
      </button>
      {trailing}
    </div>
  );
}


function MoneyInput({ value, onChange, allowNegative = false }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
      <Input type="number" min={allowNegative ? undefined : "0"} step="0.01" value={value} onChange={onChange} className="pl-7" />
    </div>
  );
}


function PaintingSectionEditor({ section, calculation, open, onToggle, onChange, onRemove, canRemove }) {
  const update = (field, value) => onChange({ ...section, [field]: value });
  const updateSurface = (field, value) => update("surfaces", { ...section.surfaces, [field]: value });
  const areasValue = (section.areas || []).join("\n");

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <SectionHeading
        title={section.name || "Untitled section"}
        description={`${(section.areas || []).join(", ") || "No rooms listed"} / ${section.wall_height || 8} ft / ${money(calculation?.subtotal)}`}
        open={open}
        onToggle={onToggle}
        trailing={canRemove ? (
          <button type="button" onClick={onRemove} title="Remove section" aria-label={`Remove ${section.name || "section"}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700">
            <SymbolIcon name="delete" className="text-[19px]" />
          </button>
        ) : null}
      />

      {open ? (
        <div className="mt-5 space-y-6 border-t border-slate-100 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <FieldLabel>Section name</FieldLabel>
              <Input value={section.name} onChange={(event) => update("name", event.target.value)} placeholder="Main Area" />
            </label>
            <label>
              <FieldLabel>Rooms or areas</FieldLabel>
              <Textarea value={areasValue} onChange={(event) => update("areas", event.target.value.split("\n"))} placeholder={"Living Room\nDining Room\nHallway"} className="min-h-24" />
            </label>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-950">Measurements</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Use measured wall or ceiling area when available. Leave either at 0 to estimate it from floor area and height.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label><FieldLabel>Floor area (sq ft)</FieldLabel><Input type="number" min="1" step="1" value={section.floor_area} onChange={(event) => update("floor_area", event.target.value)} /></label>
              <label><FieldLabel>Wall height (ft)</FieldLabel><Input type="number" min="6" max="40" step="0.5" value={section.wall_height} onChange={(event) => update("wall_height", event.target.value)} /></label>
              <label><FieldLabel>Number of coats</FieldLabel><Input type="number" min="1" max="5" step="1" value={section.number_of_coats} onChange={(event) => update("number_of_coats", event.target.value)} /></label>
              <label><FieldLabel>Measured wall area</FieldLabel><Input type="number" min="0" step="1" value={section.wall_area} onChange={(event) => update("wall_area", event.target.value)} /></label>
              <label><FieldLabel>Measured ceiling area</FieldLabel><Input type="number" min="0" step="1" value={section.ceiling_area} onChange={(event) => update("ceiling_area", event.target.value)} /></label>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-950">Surfaces</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ToggleChoice checked={!!section.surfaces?.walls} onChange={(value) => updateSurface("walls", value)} label="Walls" description="Calculated from measured area or floor area and height." />
              <ToggleChoice checked={!!section.surfaces?.ceilings} onChange={(value) => updateSurface("ceilings", value)} label="Ceilings" description="Includes an automatic high-access allowance above 9 ft." />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label><FieldLabel>Wall condition</FieldLabel><Select value={section.wall_condition} onChange={(event) => update("wall_condition", event.target.value)}><option value="standard_repaint">Standard repaint</option><option value="new_drywall">New drywall with PVA primer</option></Select></label>
            <label><FieldLabel>Paint quality</FieldLabel><Select value={section.paint_tier} onChange={(event) => update("paint_tier", event.target.value)}><option value="standard">Standard paint</option><option value="premium">Premium paint (+15%)</option></Select></label>
            <label><FieldLabel>Paint specification</FieldLabel><Input value={section.paint_material} onChange={(event) => update("paint_material", event.target.value)} placeholder="Washable eggshell, white ceiling..." /></label>
            <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-3 py-3"><input type="checkbox" checked={!!section.trim_needs_prep} onChange={(event) => update("trim_needs_prep", event.target.checked)} className="h-4 w-4 accent-slate-900" /><span className="text-sm font-medium text-slate-800">Baseboards and trim need prep / caulk</span></label>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-950">Unit rates</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label><FieldLabel>Wall rate / sq ft</FieldLabel><MoneyInput value={section.wall_unit_price} onChange={(event) => update("wall_unit_price", event.target.value)} /></label>
              <label><FieldLabel>Ceiling rate / sq ft</FieldLabel><MoneyInput value={section.ceiling_unit_price} onChange={(event) => update("ceiling_unit_price", event.target.value)} /></label>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-950">Openings and linear work</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {[
                ["Windows", "window_count", "window_unit_price", "count", "price each"],
                ["Doors", "door_count", "door_unit_price", "count", "price each"],
                ["Baseboards", "baseboard_linear_feet", "baseboard_unit_price", "linear ft", "price / ft"],
                ["Trim", "trim_linear_feet", "trim_unit_price", "linear ft", "price / ft"],
              ].map(([label, quantityKey, rateKey, quantityLabel, rateLabel]) => (
                <div key={quantityKey} className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-3 text-sm font-semibold text-slate-900">{label}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label><FieldLabel>{quantityLabel}</FieldLabel><Input type="number" min="0" step="1" value={section[quantityKey]} onChange={(event) => update(quantityKey, event.target.value)} /></label>
                    <label><FieldLabel>{rateLabel}</FieldLabel><MoneyInput value={section[rateKey]} onChange={(event) => update(rateKey, event.target.value)} /></label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="block"><FieldLabel>Section notes</FieldLabel><Textarea value={section.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Access, preparation, protection, or section-specific assumptions..." className="min-h-24" /></label>
        </div>
      ) : null}
    </section>
  );
}


function ScopeList({ title, description, value, onChange, placeholder }) {
  return (
    <label className="block">
      <FieldLabel>{title}</FieldLabel>
      <p className="mb-2 text-xs leading-5 text-slate-500">{description}</p>
      <Textarea value={(value || []).join("\n")} onChange={(event) => onChange(event.target.value.split("\n"))} placeholder={placeholder} className="min-h-28" />
    </label>
  );
}


function DetailedPreview({ inputs, calculation }) {
  return (
    <div className="space-y-5">
      {calculation.sections.map((section) => (
        <section key={section.section_id} className="border-b border-slate-200 pb-5 last:border-0 last:pb-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-950">{section.name}</h3>
              {section.areas?.length ? <p className="mt-1 text-xs text-slate-500">{section.areas.join(", ")}</p> : null}
            </div>
            <strong className="shrink-0 text-slate-950">{money(section.subtotal)}</strong>
          </div>
          <div className="mt-3 space-y-2">
            {section.line_items.map((item) => (
              <div key={item.code} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm">
                <div className="min-w-0"><span className="font-medium text-slate-800">{item.name}</span><span className="ml-1 text-xs text-slate-500">{item.quantity} {item.unit} @ {money(item.rate)}</span></div>
                <div className="font-medium text-slate-800">{money(item.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {calculation.extras.length ? (
        <section className="border-t border-slate-200 pt-5">
          <h3 className="font-bold text-slate-950">Extras</h3>
          <div className="mt-3 space-y-2">
            {calculation.extras.map((extra) => <div key={extra.id} className="flex justify-between gap-4 text-sm"><span>{extra.description}</span><strong>{Number(extra.price) >= 0 ? "+" : ""}{money(extra.price)}</strong></div>)}
          </div>
        </section>
      ) : null}
      <ScopePreview inputs={inputs} />
    </div>
  );
}


function ScopePreview({ inputs }) {
  if (!inputs.included_scope?.length && !inputs.excluded_scope?.length) return null;
  return (
    <div className="grid gap-5 border-t border-slate-200 pt-5 sm:grid-cols-2">
      {inputs.included_scope?.length ? <div><h3 className="text-sm font-bold text-slate-950">Work included</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{inputs.included_scope.filter(Boolean).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div> : null}
      {inputs.excluded_scope?.length ? <div><h3 className="text-sm font-bold text-slate-950">Work excluded</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{inputs.excluded_scope.filter(Boolean).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div> : null}
    </div>
  );
}


function SummaryPreview({ inputs, calculation }) {
  const areas = inputs.sections.flatMap((section) => section.areas?.filter(Boolean).length ? section.areas.filter(Boolean) : [section.name]);
  const derivedWork = [...new Set(calculation.line_items.map((item) => item.name))];
  const included = inputs.included_scope?.filter(Boolean).length ? inputs.included_scope.filter(Boolean) : derivedWork;
  return (
    <div className="space-y-5">
      <div><h3 className="text-sm font-bold text-slate-950">Areas included</h3><p className="mt-2 text-sm leading-6 text-slate-600">{areas.join(", ")}</p></div>
      <div><h3 className="text-sm font-bold text-slate-950">Work included</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{included.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>
      {inputs.excluded_scope?.filter(Boolean).length ? <div><h3 className="text-sm font-bold text-slate-950">Work excluded</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{inputs.excluded_scope.filter(Boolean).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div> : null}
    </div>
  );
}


function EstimatePreview({ draft, calculation, estimateNumber }) {
  const inputs = draft.inputs;
  return (
    <section aria-label="Estimate preview" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Painting estimate</div><h2 className="mt-1 break-words text-xl font-bold">{draft.project_name || "Untitled estimate"}</h2><div className="mt-1 text-xs text-slate-300">{estimateNumber || "FO-DRAFT"} / <span className="capitalize">{draft.status}</span></div></div>
          <div className="text-right"><div className="text-xs text-slate-300">Estimated price</div><div className="mt-1 text-2xl font-bold">{money(calculation.final_price)}</div></div>
        </div>
      </div>
      <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap justify-between gap-3 text-sm leading-6 text-slate-600"><div><span className="font-medium text-slate-900">Issued:</span> {readableDate(draft.issue_date)}</div><div><span className="font-medium text-slate-900">Valid until:</span> {readableDate(draft.valid_until)}</div></div>
        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2"><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prepared by</div><div className="mt-1 text-sm font-medium text-slate-900">{inputs.prepared_by || "Issuing user"}</div></div><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prepared for</div><div className="mt-1 text-sm font-medium text-slate-900">{inputs.client_name || "Client to be confirmed"}</div>{inputs.project_location ? <div className="mt-0.5 text-sm text-slate-500">{inputs.project_location}</div> : null}</div></div>
      </div>
      <div className="px-5 py-6 sm:px-7">
        {inputs.output_preference === "summary" ? <SummaryPreview inputs={inputs} calculation={calculation} /> : <DetailedPreview inputs={inputs} calculation={calculation} />}
      </div>
      <div className="border-t border-slate-200 bg-slate-50 px-5 py-5 sm:px-7">
        <div className="space-y-2 text-sm"><div className="flex justify-between gap-4"><span>Main painting work</span><strong>{money(calculation.main_painting_subtotal)}</strong></div>{Number(calculation.extras_subtotal) !== 0 ? <div className="flex justify-between gap-4"><span>Extras</span><strong>{Number(calculation.extras_subtotal) >= 0 ? "+" : ""}{money(calculation.extras_subtotal)}</strong></div> : null}<div className="flex justify-between gap-4 border-t border-slate-200 pt-2"><span>Subtotal</span><strong>{money(calculation.subtotal)}</strong></div>{Number(calculation.discount_amount) > 0 ? <div className="flex justify-between gap-4 text-emerald-700"><span>Discount</span><strong>-{money(calculation.discount_amount)}</strong></div> : null}<div className="flex justify-between gap-4 border-t border-slate-300 pt-3 text-lg text-slate-950"><strong>Painting total</strong><strong>{money(calculation.final_price)}</strong></div></div>
        {inputs.notes ? <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-600">{inputs.notes}</p> : null}
      </div>
      <div className="border-t border-slate-200 bg-white px-5 py-4 text-xs leading-5 text-slate-500 sm:px-7">This estimate was prepared by the issuing user using FlatOrigin tools. FlatOrigin does not set, verify, endorse, or guarantee the pricing or terms shown.</div>
    </section>
  );
}


function EstimatorEntry() {
  const authed = !!localStorage.getItem("access");
  const [estimatorType, setEstimatorType] = useState("painting");
  const isFraming = estimatorType === "framing";
  const isDrywall = estimatorType === "drywall";
  const isPaving = estimatorType === "paving";
  const isRoofing = estimatorType === "roofing";
  const isFlooring = estimatorType === "flooring";
  const isSiding = estimatorType === "siding";
  const isDecking = estimatorType === "decking";
  const tradeTitles = { fencing: "Fencing", windows: "Windows", doors: "Doors" };
  const tradeTitle = tradeTitles[estimatorType];
  const categoryName = tradeTitle || (isDecking ? 'Decking' : isSiding ? 'Siding' : isFlooring ? 'Flooring' : isRoofing ? 'Roofing' : isPaving ? 'Paving' : isDrywall ? 'Drywall' : isFraming ? 'Framing' : 'Painting');
  return (
    <div className="min-h-screen bg-[#FBF9F7] py-12 sm:py-20">
      <Container>
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-12">
          <SymbolIcon name={isFraming ? "foundation" : "format_paint"} className="text-[42px] text-slate-700" />
          <div className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Project Estimator</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">Build a project estimate</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Choose the work category first. Each estimator keeps its own quantities and calculation logic while all saved estimates remain together.</p>
          <label className="mx-auto mt-7 block max-w-sm text-left"><FieldLabel>Estimator type</FieldLabel><Select value={estimatorType} onChange={(event) => setEstimatorType(event.target.value)}><option value="painting">Painting</option><option value="framing">Framing</option><option value="drywall">Drywall</option><option value="paving">Paving</option><option value="roofing">Roofing</option><option value="flooring">Flooring</option><option value="siding">Siding</option><option value="decking">Decking</option><option value="fencing">Fencing</option><option value="windows">Windows</option><option value="doors">Doors</option></Select></label>
          <div className="mx-auto mt-4 max-w-sm rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"><div className="text-sm font-bold text-slate-950">{categoryName} estimator</div><p className="mt-1 text-xs leading-5 text-slate-600">{tradeTitle ? { fencing: "Estimate fence length, materials, posts, gates, and removal.", windows: "Estimate window quantities, products, installation, and finishing.", doors: "Estimate doors, frames, hardware, installation, and removal." }[estimatorType] : isDecking ? "Estimate deck boards, framing, railings, stairs, and demolition." : isSiding ? "Estimate siding by wall area, with openings, materials, labor, and extras." : isFlooring ? "Estimate flooring by room and product, with material packages, labor, and extras." : isRoofing ? "Estimate roof area, materials, installation, tear-off, and extras." : isPaving ? "Estimate paving materials by purchase-unit coverage, preparation, and installation." : isDrywall ? 'Estimate board quantities, hanging, finishing, removal, and patch repairs.' : isFraming ? "Estimate walls, openings, floors, beams, posts, roofs, hardware, labor, overhead, and profit." : "Group rooms by condition, calculate walls and ceilings, add trim work, and present detailed or summary pricing."}</p></div>
          <Link to={`/${tradeTitle ? estimatorType : isDecking ? "decking" : isSiding ? "siding" : isFlooring ? "flooring" : isRoofing ? "roofing" : isPaving ? "paving" : isDrywall ? 'drywall' : isFraming ? 'framing' : 'project'}-estimator/new`} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800"><SymbolIcon name="arrow_forward" className="text-[20px]" />Start {categoryName} Estimate</Link>
          {authed ? <div className="mt-4"><Link to="/estimates" className="text-sm font-semibold text-slate-700 hover:text-slate-950">View saved estimates</Link></div> : <p className="mt-4 text-xs text-slate-500">You can build the estimate now. Create a free account when you are ready to save it.</p>}
        </div>
      </Container>
    </div>
  );
}


export default function ProjectEstimator() {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const authed = !!localStorage.getItem("access");
  const isEntry = !estimateId;
  const isNew = estimateId === "new";
  const [draft, setDraft] = useState(createDraft);
  const [estimateNumber, setEstimateNumber] = useState("");
  const [openSections, setOpenSections] = useState({});
  const [generalOpen, setGeneralOpen] = useState(true);
  const [loading, setLoading] = useState(!isEntry && !isNew);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const calculation = useMemo(() => calculatePaintingEstimate(draft.inputs), [draft.inputs]);

  useEffect(() => {
    if (isEntry) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        if (isNew) {
          let next = createDraft();
          const pending = localStorage.getItem(PENDING_ESTIMATE_KEY);
          if (pending) {
            try {
              const parsed = JSON.parse(pending);
              if (parsed?.inputs) next = { ...next, ...parsed, inputs: normalizePaintingInputsForEditor(parsed.inputs) };
            } catch {
              localStorage.removeItem(PENDING_ESTIMATE_KEY);
            }
          }
          if (authed && !next.inputs.prepared_by) {
            const { data } = await api.get("/users/me/").catch(() => ({ data: null }));
            const name = data?.display_name || data?.username || "";
            if (name) next.inputs.prepared_by = name;
          }
          if (!cancelled) setDraft(next);
        } else {
          if (!authed) {
            navigate(`/login?next=/project-estimator/${estimateId}`, { replace: true });
            return;
          }
          const { data } = await api.get(`/estimates/${estimateId}/`);
          if (['framing', 'drywall', 'paving', 'roofing', 'flooring', 'siding', 'decking', 'fencing', 'windows', 'doors'].includes(data.estimate_type)) {
            navigate(`/${data.estimate_type}-estimator/${estimateId}`, { replace: true });
            return;
          }
          if (!cancelled) {
            setDraft({ status: data.status || "draft", project_name: data.project_name, issue_date: data.issue_date, valid_until: data.valid_until || "", inputs: normalizePaintingInputsForEditor(data.inputs) });
            setEstimateNumber(data.estimate_number);
          }
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError?.response?.status === 404 ? "This estimate was not found." : "The estimate could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [authed, estimateId, isEntry, isNew, navigate]);

  if (isEntry) return <EstimatorEntry />;

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setNotice("");
  };
  const updateInputs = (field, value) => {
    setDraft((current) => ({ ...current, inputs: { ...current.inputs, [field]: value } }));
    setNotice("");
  };
  const updateSection = (index, section) => updateInputs("sections", draft.inputs.sections.map((current, itemIndex) => itemIndex === index ? section : current));
  const addSection = () => {
    const section = createPaintingSection({ name: `Section ${draft.inputs.sections.length + 1}` });
    updateInputs("sections", [...draft.inputs.sections, section]);
    setOpenSections((current) => ({ ...current, [section.id]: true }));
  };
  const removeSection = (index) => updateInputs("sections", draft.inputs.sections.filter((_, itemIndex) => itemIndex !== index));
  const addExtra = () => updateInputs("extras", [...draft.inputs.extras, { id: `extra-${Date.now()}`, description: "", price: "" }]);
  const insertExtraAfter = (index) => {
    const extras = [...draft.inputs.extras];
    extras.splice(index + 1, 0, { id: `extra-${Date.now()}-${index}`, description: "", price: "" });
    updateInputs("extras", extras);
  };
  const updateExtra = (index, field, value) => updateInputs("extras", draft.inputs.extras.map((extra, itemIndex) => itemIndex === index ? { ...extra, [field]: value } : extra));
  const removeExtra = (index) => updateInputs("extras", draft.inputs.extras.filter((_, itemIndex) => itemIndex !== index));

  const validateDraft = () => {
    if (!draft.project_name.trim()) return "Enter a project or estimate name.";
    if (!draft.inputs.sections.length) return "Add at least one painting section.";
    for (const section of draft.inputs.sections) {
      if (Number(section.floor_area) <= 0) return `${section.name || "A section"} needs a floor area greater than zero.`;
      if (Number(section.wall_height) < 6 || Number(section.wall_height) > 40) return `${section.name || "A section"} needs a height from 6 to 40 feet.`;
      if (!Object.values(section.surfaces || {}).some(Boolean) && ![section.window_count, section.door_count, section.baseboard_linear_feet, section.trim_linear_feet].some((value) => Number(value) > 0)) return `${section.name || "A section"} needs at least one surface or work item.`;
    }
    return "";
  };

  const saveEstimate = async () => {
    setError("");
    setNotice("");
    const validationError = validateDraft();
    if (validationError) { setError(validationError); return; }
    if (!authed) {
      localStorage.setItem(PENDING_ESTIMATE_KEY, JSON.stringify(draft));
      navigate("/register?next=/project-estimator/new");
      return;
    }
    setBusy(true);
    try {
      const payload = { estimate_type: "painting", status: draft.status, project_name: draft.project_name.trim(), issue_date: draft.issue_date, valid_until: draft.valid_until || null, inputs: draft.inputs };
      const { data } = isNew ? await api.post("/estimates/", payload) : await api.patch(`/estimates/${estimateId}/`, payload);
      localStorage.removeItem(PENDING_ESTIMATE_KEY);
      setDraft({ status: data.status, project_name: data.project_name, issue_date: data.issue_date, valid_until: data.valid_until || "", inputs: normalizePaintingInputsForEditor(data.inputs) });
      setEstimateNumber(data.estimate_number);
      setNotice(isNew ? "Estimate saved to your account." : "Estimate updated.");
      if (isNew) navigate(`/project-estimator/${data.id}`, { replace: true });
    } catch (requestError) {
      const data = requestError?.response?.data;
      setError(data?.detail || (data && typeof data === "object" ? Object.values(data).flat(Infinity).join(" ") : "") || "The estimate could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const deleteEstimate = async () => {
    if (isNew || !window.confirm("Delete this saved estimate? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api.delete(`/estimates/${estimateId}/`);
      navigate("/estimates", { replace: true });
    } catch {
      setError("The estimate could not be deleted.");
      setBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#FBF9F7]"><Container className="py-16 text-sm text-slate-500">Loading estimate...</Container></div>;

  return (
    <div className="min-h-screen bg-[#FBF9F7] pb-16 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <Container className="py-7 sm:py-9">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><Link to={authed ? "/estimates" : "/project-estimator"} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-800"><SymbolIcon name="arrow_back" className="text-[17px]" />{authed ? "Estimates" : "Project Estimator"}</Link><h1 className="mt-2 text-3xl font-bold text-slate-950">Painting estimate</h1><p className="mt-2 text-sm leading-6 text-slate-600">Build one estimate with as many independently priced sections as the project needs.</p></div>
            <div className="flex gap-2">{authed ? <Link to="/project-estimator/new" className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"><SymbolIcon name="add" className="text-[18px]" />New</Link> : null}<Button type="button" onClick={saveEstimate} disabled={busy} className="h-11 gap-2"><SymbolIcon name={authed ? "save" : "person_add"} className="text-[18px]" />{authed ? "Save estimate" : "Create account to save"}</Button></div>
          </div>
        </Container>
      </div>

      <Container className="py-7">
        <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-start">
          <div className="min-w-0 space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <SectionHeading title="General information" description="Shared once across the complete estimate." open={generalOpen} onToggle={() => setGeneralOpen((value) => !value)} />
              {generalOpen ? <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2"><label className="sm:col-span-2"><FieldLabel>Estimate name</FieldLabel><Input value={draft.project_name} onChange={(event) => updateDraft("project_name", event.target.value)} placeholder="Kitchen and first floor painting" /></label><label><FieldLabel>Prepared by</FieldLabel><Input value={draft.inputs.prepared_by} onChange={(event) => updateInputs("prepared_by", event.target.value)} /></label><label><FieldLabel>Client name</FieldLabel><Input value={draft.inputs.client_name} onChange={(event) => updateInputs("client_name", event.target.value)} /></label><label className="sm:col-span-2"><FieldLabel>Project location</FieldLabel><Input value={draft.inputs.project_location} onChange={(event) => updateInputs("project_location", event.target.value)} /></label><label><FieldLabel>Issue date</FieldLabel><Input type="date" value={draft.issue_date} onChange={(event) => updateDraft("issue_date", event.target.value)} /></label><label><FieldLabel>Valid until</FieldLabel><Input type="date" value={draft.valid_until} onChange={(event) => updateDraft("valid_until", event.target.value)} /></label><label><FieldLabel>Status</FieldLabel><Select value={draft.status} onChange={(event) => updateDraft("status", event.target.value)}><option value="draft">Draft</option><option value="final">Final</option></Select></label><label><FieldLabel>Material supplier</FieldLabel><Select value={draft.inputs.material_supplier} onChange={(event) => updateInputs("material_supplier", event.target.value)}><option value="not_specified">To be confirmed</option><option value="contractor">Contractor / issuer</option><option value="client">Client / homeowner</option></Select></label></div> : null}
            </section>

            <div className="space-y-3">
              {draft.inputs.sections.map((section, index) => <PaintingSectionEditor key={section.id} section={section} calculation={calculation.sections[index]} open={openSections[section.id] ?? index === 0} onToggle={() => setOpenSections((current) => ({ ...current, [section.id]: !(current[section.id] ?? index === 0) }))} onChange={(next) => updateSection(index, next)} onRemove={() => removeSection(index)} canRemove={draft.inputs.sections.length > 1} />)}
              <button type="button" onClick={addSection} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-400 bg-white text-sm font-semibold text-slate-800 hover:border-slate-600 hover:bg-slate-50"><SymbolIcon name="add" className="text-[19px]" />Add Section</button>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-bold text-slate-950">Scope</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><ScopeList title="Included work" description="One item per line." value={draft.inputs.included_scope} onChange={(value) => updateInputs("included_scope", value)} placeholder={"Surface preparation\nTwo finish coats\nDaily cleanup"} /><ScopeList title="Excluded work" description="One item per line." value={draft.inputs.excluded_scope} onChange={(value) => updateInputs("excluded_scope", value)} placeholder={"Major drywall repairs\nCabinet interiors\nMoving furniture"} /></div></section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-950">Extras</h2><p className="mt-1 text-xs leading-5 text-slate-500">Add or subtract a simple fixed amount after painting sections.</p></div><button type="button" onClick={addExtra} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><SymbolIcon name="add" className="text-[18px]" />Add</button></div>{draft.inputs.extras.length ? <div className="mt-4 space-y-3">{draft.inputs.extras.map((extra, index) => <div key={extra.id || index} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_150px_40px_40px]"><Input value={extra.description} onChange={(event) => updateExtra(index, "description", event.target.value)} placeholder="Description" aria-label={`Extra ${index + 1} description`} /><MoneyInput value={extra.price} allowNegative onChange={(event) => updateExtra(index, "price", event.target.value)} /><button type="button" onClick={() => insertExtraAfter(index)} title="Add extra below" aria-label={`Add extra after row ${index + 1}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><SymbolIcon name="add" className="text-[19px]" /></button><button type="button" onClick={() => removeExtra(index)} title="Remove extra" aria-label={`Remove extra ${index + 1}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><SymbolIcon name="delete" className="text-[19px]" /></button></div>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">No extras. Empty rows will never appear in the customer estimate.</div>}</section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-bold text-slate-950">Discount and presentation</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><FieldLabel>Discount type</FieldLabel><Select value={draft.inputs.discount_type} onChange={(event) => updateInputs("discount_type", event.target.value)}><option value="percent">Percent</option><option value="fixed">Fixed amount</option></Select></label><label><FieldLabel>Discount</FieldLabel><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{draft.inputs.discount_type === "fixed" ? "$" : "%"}</span><Input type="number" min="0" max={draft.inputs.discount_type === "percent" ? "100" : undefined} step="0.01" value={draft.inputs.discount_value} onChange={(event) => updateInputs("discount_value", event.target.value)} className="pl-8" /></div></label><label className="sm:col-span-2"><FieldLabel>Customer output</FieldLabel><div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1">{[["detailed", "Detailed"], ["summary", "Summary"]].map(([value, label]) => <button key={value} type="button" onClick={() => updateInputs("output_preference", value)} className={[
              "h-10 rounded-lg px-3 text-sm font-semibold transition",
              draft.inputs.output_preference === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500",
            ].join(" ")}>{label}</button>)}</div><p className="mt-2 text-xs leading-5 text-slate-500">This changes presentation only. The saved calculations remain identical.</p></label><label className="sm:col-span-2"><FieldLabel>Estimate notes and assumptions</FieldLabel><Textarea value={draft.inputs.notes} onChange={(event) => updateInputs("notes", event.target.value)} placeholder="Schedule, access, payment, or other assumptions..." /></label></div></section>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-xs leading-5 text-amber-950">FlatOrigin provides estimating tools and informational pricing suggestions. The issuing user is responsible for reviewing and approving all pricing, quantities, materials, descriptions, discounts, and terms.</div>
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}
            {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div> : null}
            <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" disabled={busy} onClick={saveEstimate} className="h-11 flex-1 gap-2"><SymbolIcon name={authed ? "save" : "person_add"} className="text-[18px]" />{authed ? (isNew ? "Save estimate" : "Update estimate") : "Create free account to save"}</Button>{authed && !isNew ? <button type="button" disabled={busy} onClick={deleteEstimate} className="h-11 rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">Delete estimate</button> : null}</div>
          </div>

          <div className="min-w-0 lg:sticky lg:top-24"><EstimatePreview draft={draft} calculation={calculation} estimateNumber={estimateNumber} /></div>
        </div>
      </Container>
    </div>
  );
}
