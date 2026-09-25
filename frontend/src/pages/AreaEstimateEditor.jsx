import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { Button, Container, Input, Textarea, SymbolIcon } from '../ui';
import FlooringSectionFields, { flooringSection } from './FlooringSectionFields';
import SidingSectionFields, { sidingSection } from './SidingSectionFields';
import DeckingSectionFields, { deckingSection } from './DeckingSectionFields';
import GarageCoatingSectionFields, { garageCoatingSection } from './GarageCoatingSectionFields';
import TradeSectionFields, { tradeCategories, tradeSection } from './TradeSectionFields';

const drywallSection = () => ({ id: crypto.randomUUID(), name: 'Main area', measurement: 'floor', floor_area: 0, wall_override: false, ceiling_override: false, openings_already_deducted: false, additional_ceiling_area: 0, ceiling_description: '', pricing: 'separate', material_supplier: 'contractor', finish: '4', board_type: 'Standard gypsum', thickness: '1/2 in', walls: true, ceilings: false, deduct_material: true, deduct_labor: false, wall_area: 0, ceiling_area: 0, wall_length: 0, height: 8, length: 0, width: 0, opening_area: 0, layers: 1, sheet_width: 4, sheet_height: 8, waste: 10, sheet_price: 0, supplies: 0, hanging_rate: 0, finishing_rate: 0, installed_rate: 0, access_percent: 0, removal_rate: 0, patch_count: 0, patch_rate: 0 });
const pavingSection = () => ({ id: crypto.randomUUID(), name: 'Paving area', material: 'Concrete pavers', measurement: 'area', area: 0, length: 0, width: 0, unit: 'skid', custom_unit: '', whole_units: true, coverage: 0, unit_price: 0, waste: 0, labor_rate: 0, preparation_rate: 0, material_supplier: 'contractor', notes: '' });
const roofingSection = () => ({ id: crypto.randomUUID(), name: 'Main roof', material: 'Asphalt shingles', measurement: 'surface', area: 0, pitch: 0, waste: 10, material_supplier: 'contractor', material_rate: 0, labor_rate: 0, tearoff_layers: 0, tearoff_rate: 0, disposal: 0, extras: [], notes: '' });
const categories = { garage_coating: { title: 'Garage floor coating', section: garageCoatingSection }, ...Object.fromEntries(Object.entries(tradeCategories).map(([key, value]) => [key, { ...value, section: () => tradeSection(key) }])), drywall: { title: 'Drywall', section: drywallSection }, paving: { title: 'Paving', section: pavingSection }, roofing: { title: 'Roofing', section: roofingSection }, flooring: { title: 'Flooring', section: flooringSection }, siding: { title: 'Siding', section: sidingSection }, decking: { title: 'Decking', section: deckingSection } };
const fresh = category => ({ project_name: `${categories[category].title} estimate`, issue_date: new Date().toLocaleDateString('en-CA'), valid_until: '', status: 'draft', inputs: { sections: [categories[category].section()], prepared_by: '', client_name: '', project_location: '', notes: '', included_scope: [], excluded_scope: [], overhead: 0, profit: 0, profit_method: 'markup', tax: 0, discount: 0, discount_type: 'percent', minimum: 0, allowances: 0, adjustment: 0, output_preference: 'detailed' } });
const estimatePath = type => `/${['framing', 'drywall', 'paving', 'roofing', 'flooring', 'siding', 'decking', 'fencing', 'windows', 'doors', 'garage_coating'].includes(type) ? type : 'project'}-estimator`;
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const errorText = error => Object.entries(error.response?.data || {}).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' ') : value}`).join(' ') || 'Unable to complete the request.';

function Field({ label, value, onChange, options, type = 'number', min = 0, step = '0.01', prefix }) {
  const unit = prefix ?? (label.includes('$') ? '$' : label.includes('(%)') ? '%' : '');
  return <label className="block min-w-0 text-sm text-slate-700"><span className="mb-1.5 block font-medium">{label}</span>{options ? <select className="h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select> : <div className="relative">{unit && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{unit}</span>}<Input className={`min-w-0 w-full ${unit ? 'pl-8' : ''}`} type={type} min={type === 'number' ? min : undefined} step={step} value={value} onChange={e => onChange(e.target.value)} /></div>}</label>;
}

function FormSection({ title, description, children, collapsible = false, onRemove }) {
  const [open, setOpen] = useState(true);
  return <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      {collapsible ? <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="flex min-w-0 flex-1 items-start gap-3 text-left"><SymbolIcon name={open ? 'expand_less' : 'expand_more'} className="mt-0.5 text-[22px] text-slate-500" /><span className="min-w-0"><span className="block break-words text-lg font-bold text-slate-950">{title}</span>{description && <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>}</span></button> : <div><h2 className="text-lg font-bold text-slate-950">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}</div>}
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${title}`} title="Remove section" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><SymbolIcon name="delete" className="text-[19px]" /></button>}
    </div>
    {open && <div className={collapsible ? 'mt-5 border-t border-slate-100 pt-5' : 'mt-4'}>{children}</div>}
  </section>;
}

export default function AreaEstimateEditor({ category = 'drywall' }) {
  const coating = category === 'garage_coating';
  const paving = category === 'paving';
  const roofing = category === 'roofing';
  const flooring = category === 'flooring';
  const siding = category === 'siding';
  const decking = category === 'decking';
  const trade = Object.hasOwn(tradeCategories, category);
  const title = categories[category].title;
  const route = estimatePath(category);
  const pendingKey = `flatorigin:pending-${category}-estimate`;
  const section = categories[category].section;
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const isNew = estimateId === 'new';
  const authed = !!localStorage.getItem('access');
  const [draft, setDraft] = useState(() => fresh(category));
  const [loading, setLoading] = useState(true);
  const [calculation, setCalculation] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    if (isNew) {
      let next = fresh(category);
      try { const saved = JSON.parse(localStorage.getItem(pendingKey)); if (saved?.inputs?.sections) next = saved; } catch { /* Ignore an invalid local draft. */ }
      setDraft(next); setLoading(false);
    } else {
      api.get(`/estimates/${estimateId}/`).then(({ data }) => {
        if (!active) return;
        if (data.estimate_type !== category) { navigate(`${estimatePath(data.estimate_type)}/${estimateId}`, { replace: true }); return; }
        setDraft(data);
      }).catch(e => { if (active) setLoadError(errorText(e)); }).finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [estimateId, isNew, navigate, category, pendingKey]);
  useEffect(() => {
    if (loading || loadError) return;
    let active = true;
    setCalculating(true);
    const timer = setTimeout(() => {
      api.post(`/estimates/${category}_preview/`, draft.inputs).then(({ data }) => { if (active) { setCalculation(data); setPreviewError(''); } }).catch(e => { if (active) { setCalculation(null); setPreviewError(errorText(e)); } }).finally(() => { if (active) setCalculating(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [draft.inputs, loading, loadError, category]);
  const input = (key, value) => setDraft(d => ({ ...d, inputs: { ...d.inputs, [key]: value } }));
  const updateSection = (index, key, value) => input('sections', draft.inputs.sections.map((s, i) => i === index ? { ...s, [key]: value } : s));
  async function save() {
    if (!draft.project_name.trim()) { setNotice('Enter an estimate name.'); return; }
    if (!localStorage.getItem('access')) { localStorage.setItem(pendingKey, JSON.stringify(draft)); navigate(`/register?next=${route}/new`); return; }
    setBusy(true);
    try {
      const payload = { project_name: draft.project_name, issue_date: draft.issue_date, valid_until: draft.valid_until || null, status: draft.status, inputs: draft.inputs, estimate_type: category };
      const { data } = await api[isNew ? 'post' : 'patch'](isNew ? '/estimates/' : `/estimates/${estimateId}/`, payload);
      localStorage.removeItem(pendingKey); setNotice('Estimate saved.');
      if (isNew) navigate(`${route}/${data.id}`, { replace: true });
    } catch (e) { setNotice(errorText(e)); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('Delete this estimate permanently?')) return;
    setBusy(true);
    try { await api.delete(`/estimates/${estimateId}/`); navigate('/estimates'); } catch (e) { setNotice(errorText(e)); setBusy(false); }
  }
  if (loading || loadError) return <Container className="py-10">{loadError || 'Loading estimate...'}</Container>;
  const i = draft.inputs;
  return <div className="min-h-screen bg-[#FBF9F7] pb-16 text-slate-900">
    <div className="border-b border-slate-200 bg-white"><Container className="py-7 sm:py-9"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><Link to={authed ? '/estimates' : '/project-estimator'} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-800"><SymbolIcon name="arrow_back" className="text-[17px]" />{authed ? 'Estimates' : 'Project Estimator'}</Link><h1 className="mt-2 text-3xl font-bold text-slate-950">{title} estimate</h1><p className="mt-2 text-sm leading-6 text-slate-600">{coating ? 'Estimate garage floor coating systems, surface preparation, repairs, and finishes.' : trade ? tradeCategories[category].description : decking ? 'Estimate deck boards, framing, railings, stairs, and demolition.' : siding ? 'Estimate exterior walls, siding materials, labor, and extras.' : flooring ? 'Estimate flooring by room and product, including materials, labor, and extras.' : roofing ? 'Estimate roof covering, installation, tear-off, and roofing extras.' : paving ? 'Price paving materials by coverage and installation by square foot.' : 'Build one estimate with independently priced drywall sections and repairs.'}</p></div>
      <div className="flex gap-2">{authed && <Link to={`${route}/new`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"><SymbolIcon name="add" className="text-[18px]" />New</Link>}<Button type="button" onClick={save} disabled={busy || calculating || !!previewError} className="h-11 gap-2"><SymbolIcon name={authed ? 'save' : 'person_add'} className="text-[18px]" />{authed ? 'Save estimate' : 'Create account to save'}</Button></div>
    </div></Container></div>
    <Container className="py-7"><div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-start"><div className="min-w-0 space-y-5">
      <FormSection title="General information" description="Shared once across the complete estimate." collapsible><div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Estimate name" type="text" value={draft.project_name} onChange={v => setDraft({ ...draft, project_name: v })} /></div>
        {Object.entries({prepared_by: 'Prepared by', client_name: 'Client name', project_location: 'Project location'}).map(([key, label]) => <div key={key} className={key === 'project_location' ? 'sm:col-span-2' : ''}><Field label={label} type="text" value={i[key]} onChange={v => input(key, v)} /></div>)}
        {Object.entries({issue_date: 'Issue date', valid_until: 'Valid until'}).map(([key, label]) => <Field key={key} label={label} type="date" value={draft[key] || ''} onChange={v => setDraft({ ...draft, [key]: v })} />)}
        <Field label="Status" value={draft.status} options={[[ 'draft', 'Draft' ], ['final', 'Final']]} onChange={v => setDraft({ ...draft, status: v })} />
      </div></FormSection>
      {i.sections.map((s, index) => {
        const field = (key, label, options, type = 'number') => <Field key={key} label={label} value={s[key] ?? (type === 'text' ? '' : 0)} options={options} type={type} onChange={v => updateSection(index, key, v)} />;
        const toggle = (key, label) => <label key={key} className="flex items-center gap-3 text-sm text-slate-700"><input className="h-4 w-4 accent-slate-900" type="checkbox" checked={!!s[key]} onChange={e => updateSection(index, key, e.target.checked)} />{label}</label>;
        const result = calculation?.sections[index];
        return <FormSection key={s.id} title={s.name || `Section ${index + 1}`} description={`${paving || roofing || flooring || siding || decking || trade || coating ? s.material : `${s.board_type} / ${s.thickness}`} / ${money(result?.subtotal)}`} collapsible onRemove={i.sections.length > 1 ? () => input('sections', i.sections.filter((_, j) => j !== index)) : undefined}><div className="grid gap-4 sm:grid-cols-2">
          {coating ? <GarageCoatingSectionFields s={s} field={field} toggle={toggle} update={(key, value) => updateSection(index, key, value)} result={result} calculating={calculating} /> : trade ? <TradeSectionFields category={category} s={s} field={field} toggle={toggle} update={(key, value) => updateSection(index, key, value)} /> : decking ? <DeckingSectionFields s={s} field={field} toggle={toggle} update={(key, value) => updateSection(index, key, value)} result={result} calculating={calculating} Field={Field} /> : siding ? <SidingSectionFields s={s} field={field} toggle={toggle} update={(key, value) => updateSection(index, key, value)} result={result} calculating={calculating} Field={Field} /> : flooring ? <FlooringSectionFields s={s} field={field} toggle={toggle} update={(key, value) => updateSection(index, key, value)} result={result} calculating={calculating} Field={Field} /> : roofing ? <>
            {field('name', 'Roof section name', null, 'text')}
            <label className="min-w-0 text-sm font-medium text-slate-700"><span className="mb-1.5 block">Roofing material</span><Input list={`roof-materials-${s.id}`} value={s.material} onChange={e => updateSection(index, 'material', e.target.value)} /><datalist id={`roof-materials-${s.id}`}>{['Asphalt shingles', 'Metal roofing', 'Clay tile', 'Concrete tile', 'Slate', 'Membrane roofing'].map(name => <option key={name} value={name} />)}</datalist></label>
            {field('measurement', 'Roof measurement', [['surface', 'Actual roof surface area'], ['footprint', 'Horizontal roof footprint + pitch']])}
            {field('area', s.measurement === 'surface' ? 'Roof surface area (sq ft)' : 'Horizontal roof footprint including overhangs (sq ft)')}
            {s.measurement === 'footprint' && field('pitch', 'Roof pitch (rise in inches per 12 inches run)')}
            <p className="text-xs leading-5 text-slate-500 sm:col-span-2">{s.measurement === 'surface' ? 'Measured sloped surface area. No pitch adjustment is applied.' : 'Use horizontal roof coverage, not the combined floor area of multiple stories. Add a separate section for each different pitch.'}</p>
            {field('waste', 'Material waste (%)')}
            {field('material_supplier', 'Roof covering supplier', [['contractor', 'Contractor'], ['client', 'Customer']])}
            {field('material_rate', 'Roof covering material / sq ft ($)')}
            {field('labor_rate', 'Installation labor / roof sq ft ($)')}
            {field('tearoff_layers', 'Existing layers to remove (0 = none)')}
            {Number(s.tearoff_layers) > 0 && field('tearoff_rate', 'Tear-off labor / sq ft / layer ($)')}
            {field('disposal', 'Section disposal allowance ($)')}
            <div className="min-w-0 space-y-4 border-t border-slate-200 pt-4 sm:col-span-2">
              <h3 className="font-semibold">Roofing extras</h3>
              {(s.extras || []).map((extra, extraIndex) => {
                const change = (key, value) => updateSection(index, 'extras', s.extras.map((row, j) => j === extraIndex ? { ...row, [key]: value } : row));
                return <div key={extra.id} className="grid min-w-0 gap-3 border-b border-slate-100 pb-4 sm:grid-cols-2">
                  <Field label="Extra name" type="text" value={extra.name} onChange={v => change('name', v)} />
                  <Field label="Extra unit" value={extra.unit} options={['linear ft', 'sq ft', 'each', 'allowance'].map(v => [v, v])} onChange={v => change('unit', v)} />
                  <Field label="Extra quantity" value={extra.quantity} onChange={v => change('quantity', v)} />
                  <Field label="Extra installed price / unit ($)" value={extra.rate} onChange={v => change('rate', v)} />
                  <button type="button" aria-label={`Remove extra ${extraIndex + 1}`} onClick={() => updateSection(index, 'extras', s.extras.filter((_, j) => j !== extraIndex))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50" title="Remove extra"><SymbolIcon name="delete" /></button>
                </div>;
              })}
              <button type="button" onClick={() => updateSection(index, 'extras', [...(s.extras || []), { id: crypto.randomUUID(), name: 'Flashing / ridge caps', unit: 'linear ft', quantity: 0, rate: 0 }])} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-800"><SymbolIcon name="add" />Add roofing extra</button>
            </div>
            <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2"><span className="mb-1.5 block">Roof section notes</span><Textarea value={s.notes} maxLength={240} onChange={e => updateSection(index, 'notes', e.target.value)} placeholder="Access, complexity, underlayment, flashing, or decking assumptions" /></label>
            {!calculating && result && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:col-span-2">{result.area} sq ft of roof ({result.roofing_squares} roofing squares). Material allowance: {result.purchase_area} sq ft including waste. Installation labor excludes waste. Extras use their own installed rates.</div>}
          </> : paving ? <>
            {field('name', 'Section name', null, 'text')}
            <label className="text-sm font-medium text-slate-700"><span className="mb-1.5 block">Material</span><Input list={`materials-${s.id}`} value={s.material} onChange={e => updateSection(index, 'material', e.target.value)} placeholder="Choose or type a material" /><datalist id={`materials-${s.id}`}>{['Concrete pavers', 'Asphalt', 'Poured concrete', 'Brick pavers', 'Natural stone'].map(name => <option key={name} value={name} />)}</datalist></label>
            {field('measurement', 'Area method', [['area', 'Enter square feet'], ['dimensions', 'Length x width']])}
            {s.measurement === 'area' ? field('area', 'Project area (sq ft)') : <>{field('length', 'Length (ft)')}{field('width', 'Width (ft)')}</>}
            {field('unit', 'Purchase unit', [['skid', 'Skid / pallet'], ['bag', 'Bag'], ['ton', 'Ton'], ['cubic_meter', 'Cubic meter'], ['cubic_yard', 'Cubic yard'], ['square_foot', 'Square foot'], ['custom', 'Custom unit']])}
            {s.unit === 'custom' && <>{field('custom_unit', 'Custom unit name', null, 'text')}{toggle('whole_units', 'Round up to whole purchase units')}</>}
            {field('coverage', 'Coverage per purchase unit (sq ft)')}
            {field('unit_price', 'Price per purchase unit ($)')}
            {field('waste', 'Material waste (%)')}
            {field('material_supplier', 'Material supplier', [['contractor', 'Contractor'], ['client', 'Customer']])}
            {field('labor_rate', 'Installation labor / sq ft ($)')}
            {field('preparation_rate', 'Site preparation / sq ft ($)')}
            <label className="text-sm font-medium text-slate-700 sm:col-span-2"><span className="mb-1.5 block">Material and coverage notes</span><Textarea value={s.notes} onChange={e => updateSection(index, 'notes', e.target.value)} placeholder="Product, supplier coverage, thickness, or preparation details" /></label>
            {!calculating && result && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:col-span-2">{result.area} sq ft + {s.waste}% waste = {result.purchase_area} sq ft. Order {result.ordered_units} {result.unit_label.toLowerCase()} units{result.whole_units ? ' (rounded up)' : ' (fractional quantity)'}. Labor applies to {result.area} sq ft.</div>}
          </> : <>
          {field('name', 'Section name', null, 'text')}{field('measurement', 'Area method', [['floor', 'Estimate from floor area'], ['measured', 'Measured surface area'], ['dimensions', 'Wall lengths and room dimensions']])}
          {['walls', 'ceilings', 'deduct_material', 'deduct_labor'].map(key => <label key={key} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium text-slate-800"><input type="checkbox" className="h-4 w-4 shrink-0 accent-slate-900" checked={s[key]} onChange={e => updateSection(index, key, e.target.checked)} />{{ walls: 'Walls', ceilings: 'Ceilings', deduct_material: 'Deduct openings from materials', deduct_labor: 'Deduct openings from labor' }[key]}</label>)}
          {s.measurement === 'floor' ? <>
            {field('floor_area', 'Floor area (sq ft)')}{s.walls && field('height', 'Wall height (ft)')}
            {s.walls && <>{toggle('wall_override', 'Use measured wall area')}{s.wall_override && field('wall_area', 'Measured wall area (sq ft)')}</>}
            {s.ceilings && <>{toggle('ceiling_override', 'Use measured ceiling area')}{s.ceiling_override && field('ceiling_area', 'Measured base ceiling area (sq ft)')}</>}
          </> : s.measurement === 'measured' ? <>{s.walls && field('wall_area', 'Wall area (sq ft)')}{s.ceilings && field('ceiling_area', 'Base ceiling area (sq ft)')}</> : <>{s.walls && <>{field('wall_length', 'Total wall length (ft)')}{field('height', 'Wall height (ft)')}</>}{s.ceilings && <>{field('length', 'Ceiling length (ft)')}{field('width', 'Ceiling width (ft)')}</>}</>}
          {s.walls && (s.measurement === 'measured' || (s.measurement === 'floor' && s.wall_override)) && toggle('openings_already_deducted', 'Measured wall area already excludes openings')}
          {s.walls && !(s.openings_already_deducted && (s.measurement === 'measured' || (s.measurement === 'floor' && s.wall_override))) && field('opening_area', 'Total door/window opening area (sq ft)')}
          {s.ceilings && <>{field('additional_ceiling_area', 'Additional ceiling surfaces (sq ft)')}{field('ceiling_description', 'Ceiling design description', null, 'text')}<p className="text-xs leading-5 text-slate-500 sm:col-span-2">Add recess sides, drops, overlapping features, and LED coves not included in the base area. Adjust this section's labor rates for curved cuts and complex finishing. Board layers are sheets over the same surface, not decorative levels.</p></>}
          {!calculating && result && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:col-span-2">{s.walls && <p>{result.wall_source} walls: {result.wall_area} sq ft</p>}{s.ceilings && <p>{result.ceiling_source} base ceiling: {result.ceiling_area} sq ft + {result.additional_ceiling_area} sq ft additional surfaces</p>}{s.measurement === 'floor' && <p className="mt-1 text-xs">Wall estimate: floor area x 3.5 x (wall height / 8). Measured overrides replace the estimate.</p>}</div>}
          {field('board_type', 'Board specification', null, 'text')}{field('thickness', 'Board thickness', null, 'text')}
          {field('layers', 'Board layers')}{field('finish', 'Finish level', ['0','1','2','3','4','5'].map(v => [v, `Level ${v}`]))}
          {field('sheet_width', 'Sheet width (ft)')}{field('sheet_height', 'Sheet length (ft)')}{field('waste', 'Material waste (%)')}
          {field('pricing', 'Pricing method', [['separate', 'Separate materials and labor'], ['installed', 'All-inclusive installed rate']])}
          {s.pricing === 'installed' ? field('installed_rate', 'Installed rate / sq ft (all layers and access included)') : <>
            {field('material_supplier', 'Material supplier', [['contractor', 'Contractor'], ['client', 'Customer']])}
            {s.material_supplier === 'contractor' && <>{field('sheet_price', 'Price / sheet ($)')}{field('supplies', 'Tape, compound, screws and bead allowance ($)')}</>}
            {field('hanging_rate', 'Hanging labor / sq ft / layer ($)')}{field('finishing_rate', 'Finishing labor / surface sq ft ($)')}{field('access_percent', 'Additional access labor (%)')}
          </>}
          {field('removal_rate', 'Removal / gross sq ft ($)')}{field('patch_count', 'Patch quantity')}{field('patch_rate', 'Price / patch ($)')}
          </>}
        </div></FormSection>;
      })}
      <button type="button" onClick={() => input('sections', [...i.sections, section()])} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-400 bg-white text-sm font-semibold text-slate-800 hover:border-slate-600 hover:bg-slate-50"><SymbolIcon name="add" className="text-[19px]" />Add Section</button>
      <FormSection title="Scope"><div className="grid gap-4 sm:grid-cols-2">
        {['included_scope', 'excluded_scope'].map(key => <label key={key} className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">{key === 'included_scope' ? 'Included work' : 'Excluded work'}</span><p className="mb-2 text-xs font-normal leading-5 text-slate-500">One item per line.</p><Textarea className="min-h-28" value={i[key].join('\n')} onChange={e => input(key, e.target.value.split('\n'))} placeholder={coating ? (key === 'included_scope' ? 'Specified coating system and selected preparation' : 'Hidden concrete damage and unpriced moisture mitigation') : trade ? (key === 'included_scope' ? `${title} installation` : 'Hidden damage and structural alterations') : decking ? (key === 'included_scope' ? 'Deck-board installation' : 'Hidden structural damage') : siding ? (key === 'included_scope' ? 'Siding installation' : 'Hidden wall damage') : flooring ? (key === 'included_scope' ? 'Flooring installation' : 'Hidden subfloor damage') : roofing ? (key === 'included_scope' ? 'Roof covering installation' : 'Hidden decking damage') : paving ? (key === 'included_scope' ? 'Site preparation\nPaver installation\nCleanup' : 'Drainage alterations\nExcavation\nLandscaping') : (key === 'included_scope' ? 'Board installation\nJoint finishing\nDaily cleanup' : 'Painting\nInsulation\nStructural repairs')} /></label>)}
      </div></FormSection>
      <FormSection title="Allowances and adjustments"><div className="grid gap-4 sm:grid-cols-2">
        <Field label={roofing || flooring || siding || decking || trade || coating ? 'Additional delivery, protection and equipment allowance ($)' : 'Delivery, disposal, protection and equipment allowance ($)'} value={i.allowances} onChange={v => input('allowances', v)} />
        <Field label="Price adjustment (+/- $)" min={null} value={i.adjustment} onChange={v => input('adjustment', v)} />
      </div></FormSection>
      <FormSection title="Pricing"><div className="grid gap-4 sm:grid-cols-2">
        {Object.entries({ overhead: 'Overhead (%)', profit: 'Profit (%)', tax: 'Tax on selling total (%)', minimum: 'Minimum price before tax ($)' }).map(([key, label]) => <Field key={key} label={label} value={i[key]} onChange={v => input(key, v)} />)}
        <Field label="Profit method" value={i.profit_method} options={[[ 'markup', 'Markup on cost' ], ['margin', 'Target margin']]} onChange={v => input('profit_method', v)} />
      </div></FormSection>
      <FormSection title="Discount and presentation"><div className="grid gap-4 sm:grid-cols-2">
        <Field label="Discount type" value={i.discount_type} options={[[ 'percent', 'Percent' ], ['fixed', 'Fixed amount']]} onChange={v => input('discount_type', v)} />
        <Field label="Discount" prefix={i.discount_type === 'fixed' ? '$' : '%'} value={i.discount} onChange={v => input('discount', v)} />
        <div className="sm:col-span-2"><div id="drywall-output-label" className="mb-1.5 text-sm font-medium text-slate-700">Customer output</div><div role="group" aria-labelledby="drywall-output-label" className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1">{[['detailed', 'Detailed'], ['summary', 'Summary']].map(([value, label]) => <button key={value} type="button" aria-pressed={i.output_preference === value} onClick={() => input('output_preference', value)} className={`h-10 rounded-lg px-3 text-sm font-semibold transition ${i.output_preference === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div></div>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2"><span className="mb-1.5 block">Estimate notes and assumptions</span><Textarea value={i.notes} onChange={e => input('notes', e.target.value)} placeholder="Schedule, access, allowance details, or other assumptions..." /></label>
      </div></FormSection>
      {notice && <div role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">{notice}</div>}
      {previewError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{previewError}</div>}
      <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" disabled={busy || calculating || !!previewError} onClick={save} className="h-11 flex-1 gap-2"><SymbolIcon name={authed ? 'save' : 'person_add'} className="text-[18px]" />{authed ? (isNew ? 'Save estimate' : 'Update estimate') : 'Create free account to save'}</Button>{authed && !isNew && <button type="button" disabled={busy} onClick={remove} className="h-11 rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60">Delete estimate</button>}</div>
    </div><section aria-label="Estimate preview" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24">
      <header className="flex flex-wrap justify-between gap-4 bg-slate-950 p-5 text-white"><div className="min-w-0"><div className="text-xs text-slate-300">{title} estimate</div><h2 className="break-words text-xl font-bold">{draft.project_name}</h2><div className="text-xs text-slate-300">{draft.estimate_number || 'Unsaved draft'}</div></div><div><div className="text-xs text-slate-300">Estimated price</div><strong className="text-2xl">{calculating ? 'Updating...' : calculation ? money(calculation.final_price) : '--'}</strong></div></header>
      <div className="space-y-5 p-5" aria-live="polite">{previewError && <p className="text-sm text-red-700">{previewError}</p>}
        <div className="text-sm text-slate-600">{i.prepared_by && <p>Prepared by: {i.prepared_by}</p>}{i.client_name && <p>Prepared for: {i.client_name}</p>}{i.project_location && <p>{i.project_location}</p>}</div>
        {!calculating && calculation?.sections.map((s, index) => <div key={index} className="border-b border-slate-200 pb-4"><div className="flex justify-between gap-3"><h3 className="min-w-0 break-words font-bold">{s.name}</h3><strong className="shrink-0">{money(s.subtotal)}</strong></div>
          {(paving || roofing || flooring || siding || decking || trade || coating) && <p className="mt-1 break-words text-sm text-slate-600">{s.material}</p>}
          {coating && <div className="mt-1 break-words text-sm text-slate-600">{s.product_name && <p>{s.product_name}</p>}{s.system_description && <p>{s.system_description}</p>}</div>}
          {(s.ceiling_description || s.notes) && <p className="mt-1 break-words text-sm text-slate-600">{s.ceiling_description || s.notes}</p>}
          {(trade || coating) && i.output_preference === 'detailed' && <p className="my-2 text-xs leading-5 text-slate-500">{s.quantity_summary}</p>}
          {decking && i.output_preference === 'detailed' && <div className="my-2 text-xs leading-5 text-slate-500"><p>{s.area} deck sq ft / {s.purchase_area} deck-board material sq ft including waste.</p><p>Framing and deck installation exclude board waste. Railings, stairs, and demolition use their own quantities.</p></div>}
          {siding && i.output_preference === 'detailed' && <div className="my-2 text-xs leading-5 text-slate-500"><p>{s.measurement === 'net' ? `${s.area} net sq ft (openings already excluded)` : `${s.measured_area} gross sq ft - ${s.openings} opening sq ft = ${s.area} net sq ft`}</p><p>{s.purchase_area} material sq ft including waste ({s.squares} squares). One square = 100 sq ft.</p><p>Installation: {s.area} sq ft. Removal: {s.removal_area} sq ft. Extras use their own quantities and installed rates.</p></div>}
          {flooring && <div className="mt-1 break-words text-sm text-slate-600">{s.brand_model && <p>{s.brand_model}</p>}{s.product_link && /^https?:\/\//i.test(s.product_link) && <a className="text-blue-700 underline" href={s.product_link} target="_blank" rel="noopener noreferrer">Product details</a>}</div>}
          {flooring && i.output_preference === 'detailed' && <div className="my-2 text-xs leading-5 text-slate-500"><p>{s.area} floor sq ft / {s.purchase_area} material sq ft including waste</p>{s.pricing === 'package' && <p>{s.packages} whole packages x {s.coverage} sq ft = {s.ordered_coverage} sq ft ordered coverage.</p>}<p>Removal area: {s.removal_area} sq ft. Installation excludes material waste and package rounding.</p></div>}
          {roofing && i.output_preference === 'detailed' && <div className="my-2 text-xs leading-5 text-slate-500"><p>{s.area} roof sq ft / {s.roofing_squares} roofing squares / {s.purchase_area} material sq ft including waste</p><p>{s.measurement === 'footprint' ? `${s.input_area} footprint sq ft x ${s.pitch_factor} slope factor (${s.pitch}:12 pitch).` : 'Measured roof surface; no slope multiplier.'} One roofing square = 100 sq ft.</p></div>}
          {i.output_preference === 'detailed' && <>
            {!roofing && !flooring && !siding && !decking && !trade && !coating && <>
            {paving ? <><p className="my-2 text-xs text-slate-500">{s.area} sq ft / {s.purchase_area} sq ft including waste / {s.ordered_units} {s.unit_label.toLowerCase()} units</p><details className="mb-3 text-xs text-slate-600"><summary className="cursor-pointer">How was the purchase quantity calculated?</summary>Area including waste / contractor-entered coverage ({s.coverage} sq ft per unit). {s.whole_units ? 'Rounded up to whole units.' : 'Rounded up to four decimal places.'} Ordered coverage: {s.ordered_coverage} sq ft.</details></> : <><p className="my-2 text-xs text-slate-500">{s.gross_area} total surface sq ft / {s.net_area} net sq ft / {s.sheets} sheets</p>{i.sections[index]?.ceilings && <p className="mb-2 text-xs text-slate-500">{s.ceiling_source} base ceiling: {s.ceiling_area} sq ft + {s.additional_ceiling_area} sq ft additional surfaces</p>}<details className="mb-3 text-xs text-slate-600"><summary className="cursor-pointer">How were sheets calculated?</summary>Round up (net area x layers x waste factor / sheet coverage). Purchase area: {s.purchase_area} sq ft.</details></>}
            </>}
            {s.line_items.filter(line => Number(line.quantity) > 0).map((line, j) => <div key={j} className="my-2 flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{line.name}<small className="block text-slate-500">{line.customer_supplied ? 'Customer supplied; excluded from price' : `${line.quantity} ${line.unit} at ${money(line.rate)}`}</small></span><span className="shrink-0">{money(line.amount)}</span></div>)}
          </>}
        </div>)}
        {!calculating && calculation && <div className="space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal including adjustments and tax</span><span>{money(calculation.subtotal)}</span></div><div className="flex justify-between"><span>Discount</span><span>-{money(calculation.discount_amount)}</span></div><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(calculation.final_price)}</span></div></div>}
        {['included_scope', 'excluded_scope'].map(key => i[key].some(Boolean) && <div key={key}><h3 className="font-semibold">{key === 'included_scope' ? 'Included' : 'Excluded'}</h3>{i[key].filter(Boolean).map((line, j) => <p key={j} className="break-words text-sm text-slate-600">{line}</p>)}</div>)}
        {i.notes && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{i.notes}</p>}
      </div>
    </section></div>
  </Container></div>;
}
