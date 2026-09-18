import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { Container, Input, Textarea, SymbolIcon } from '../ui';

const pendingKey = 'flatorigin:pending-drywall-estimate';
const section = () => ({ id: crypto.randomUUID(), name: 'Main area', measurement: 'measured', pricing: 'separate', material_supplier: 'contractor', finish: '4', board_type: 'Standard gypsum', thickness: '1/2 in', walls: true, ceilings: false, deduct_material: true, deduct_labor: false, wall_area: 0, ceiling_area: 0, wall_length: 0, height: 8, length: 0, width: 0, opening_area: 0, layers: 1, sheet_width: 4, sheet_height: 8, waste: 10, sheet_price: 0, supplies: 0, hanging_rate: 0, finishing_rate: 0, installed_rate: 0, access_percent: 0, removal_rate: 0, patch_count: 0, patch_rate: 0 });
const fresh = () => ({ project_name: 'Drywall estimate', issue_date: new Date().toLocaleDateString('en-CA'), valid_until: '', status: 'draft', inputs: { sections: [section()], prepared_by: '', client_name: '', project_location: '', notes: '', included_scope: [], excluded_scope: [], overhead: 0, profit: 0, profit_method: 'markup', tax: 0, discount: 0, discount_type: 'percent', minimum: 0, allowances: 0, adjustment: 0, output_preference: 'detailed' } });
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const errorText = error => Object.entries(error.response?.data || {}).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' ') : value}`).join(' ') || 'Unable to complete the request.';

function Field({ label, value, onChange, options, type = 'number', min = 0, step = '0.01' }) {
  return <label className="block min-w-0 text-sm text-slate-700"><span className="mb-1.5 block">{label}</span>{options ? <select className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2" value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select> : <Input className="min-w-0 w-full" type={type} min={type === 'number' ? min : undefined} step={step} value={value} onChange={e => onChange(e.target.value)} />}</label>;
}

export default function DrywallEstimator() {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const isNew = estimateId === 'new';
  const [draft, setDraft] = useState(fresh);
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
      let next = fresh();
      try { const saved = JSON.parse(localStorage.getItem(pendingKey)); if (saved?.inputs?.sections) next = saved; } catch { /* Ignore an invalid local draft. */ }
      setDraft(next); setLoading(false);
    } else {
      api.get(`/estimates/${estimateId}/`).then(({ data }) => {
        if (!active) return;
        if (data.estimate_type !== 'drywall') { navigate(`/${data.estimate_type === 'framing' ? 'framing' : 'project'}-estimator/${estimateId}`, { replace: true }); return; }
        setDraft(data);
      }).catch(e => { if (active) setLoadError(errorText(e)); }).finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [estimateId, isNew, navigate]);
  useEffect(() => {
    if (loading || loadError) return;
    let active = true;
    setCalculating(true);
    const timer = setTimeout(() => {
      api.post('/estimates/drywall_preview/', draft.inputs).then(({ data }) => { if (active) { setCalculation(data); setPreviewError(''); } }).catch(e => { if (active) { setCalculation(null); setPreviewError(errorText(e)); } }).finally(() => { if (active) setCalculating(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [draft.inputs, loading, loadError]);
  const input = (key, value) => setDraft(d => ({ ...d, inputs: { ...d.inputs, [key]: value } }));
  const updateSection = (index, key, value) => input('sections', draft.inputs.sections.map((s, i) => i === index ? { ...s, [key]: value } : s));
  async function save() {
    if (!draft.project_name.trim()) { setNotice('Enter an estimate name.'); return; }
    if (!localStorage.getItem('access')) { localStorage.setItem(pendingKey, JSON.stringify(draft)); navigate('/register?next=/drywall-estimator/new'); return; }
    setBusy(true);
    try {
      const payload = { project_name: draft.project_name, issue_date: draft.issue_date, valid_until: draft.valid_until || null, status: draft.status, inputs: draft.inputs, estimate_type: 'drywall' };
      const { data } = await api[isNew ? 'post' : 'patch'](isNew ? '/estimates/' : `/estimates/${estimateId}/`, payload);
      localStorage.removeItem(pendingKey); setNotice('Estimate saved.');
      if (isNew) navigate(`/drywall-estimator/${data.id}`, { replace: true });
    } catch (e) { setNotice(errorText(e)); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('Delete this estimate permanently?')) return;
    setBusy(true);
    try { await api.delete(`/estimates/${estimateId}/`); navigate('/estimates'); } catch (e) { setNotice(errorText(e)); setBusy(false); }
  }
  if (loading || loadError) return <Container className="py-10">{loadError || 'Loading estimate...'}</Container>;
  const i = draft.inputs;
  return <div className="min-h-screen bg-slate-50 pb-12"><Container className="py-8">
    <Link to="/project-estimator" className="text-sm text-slate-600">Project Estimator</Link>
    <div className="my-5 flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-bold">Drywall estimate</h1><button onClick={save} disabled={busy || calculating || !!previewError} className="rounded-lg bg-slate-950 px-5 py-3 text-white disabled:opacity-50">{localStorage.getItem('access') ? 'Save estimate' : 'Create account to save'}</button></div>
    <div className="grid min-w-0 items-start gap-8 lg:grid-cols-2"><div className="min-w-0 space-y-6">
      <details open className="border-b border-slate-200 pb-6"><summary className="cursor-pointer text-lg font-bold">Estimate details</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Estimate name" type="text" value={draft.project_name} onChange={v => setDraft({ ...draft, project_name: v })} />
        {['prepared_by', 'client_name', 'project_location'].map(key => <Field key={key} label={key.replaceAll('_', ' ')} type="text" value={i[key]} onChange={v => input(key, v)} />)}
        {['issue_date', 'valid_until'].map(key => <Field key={key} label={key.replaceAll('_', ' ')} type="date" value={draft[key] || ''} onChange={v => setDraft({ ...draft, [key]: v })} />)}
        <Field label="Status" value={draft.status} options={[[ 'draft', 'Draft' ], ['final', 'Final']]} onChange={v => setDraft({ ...draft, status: v })} />
      </div></details>
      {i.sections.map((s, index) => {
        const field = (key, label, options, type = 'number') => <Field key={key} label={label} value={s[key]} options={options} type={type} onChange={v => updateSection(index, key, v)} />;
        return <details open key={s.id} className="rounded-lg border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-bold">{s.name || `Section ${index + 1}`}</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
          {field('name', 'Section name', null, 'text')}{field('measurement', 'Area method', [['measured', 'Measured surface area'], ['dimensions', 'Wall lengths and room dimensions']])}
          {['walls', 'ceilings', 'deduct_material', 'deduct_labor'].map(key => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s[key]} onChange={e => updateSection(index, key, e.target.checked)} />{{ walls: 'Walls', ceilings: 'Ceilings', deduct_material: 'Deduct openings from materials', deduct_labor: 'Deduct openings from labor' }[key]}</label>)}
          {s.measurement === 'measured' ? <>{s.walls && field('wall_area', 'Wall area (sq ft)')}{s.ceilings && field('ceiling_area', 'Ceiling area (sq ft)')}</> : <>{s.walls && <>{field('wall_length', 'Total wall length (ft)')}{field('height', 'Wall height (ft)')}</>}{s.ceilings && <>{field('length', 'Ceiling length (ft)')}{field('width', 'Ceiling width (ft)')}</>}</>}
          {s.walls && field('opening_area', 'Total door/window opening area (sq ft)')}
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
        </div>{i.sections.length > 1 && <button aria-label={`Remove ${s.name}`} title="Remove section" onClick={() => input('sections', i.sections.filter((_, j) => j !== index))} className="mt-4 text-red-700"><SymbolIcon name="delete" /></button>}</details>;
      })}
      <button onClick={() => input('sections', [...i.sections, section()])} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-3"><SymbolIcon name="add" />Add drywall section</button>
      <section className="border-t border-slate-200 pt-5"><h2 className="text-lg font-bold">Pricing and scope</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
        {Object.entries({ allowances: 'Delivery, disposal, protection and equipment allowance ($)', overhead: 'Overhead (%)', profit: 'Profit (%)', tax: 'Tax on selling total (%)', minimum: 'Minimum price before tax ($)', adjustment: 'Price adjustment (+/- $)', discount: 'Discount' }).map(([key, label]) => <Field key={key} label={label} min={key === 'adjustment' ? undefined : 0} value={i[key]} onChange={v => input(key, v)} />)}
        <Field label="Profit method" value={i.profit_method} options={[[ 'markup', 'Markup on cost' ], ['margin', 'Target margin']]} onChange={v => input('profit_method', v)} />
        <Field label="Discount type" value={i.discount_type} options={[[ 'percent', 'Percent' ], ['fixed', 'Fixed amount']]} onChange={v => input('discount_type', v)} />
        <Field label="Output" value={i.output_preference} options={[[ 'detailed', 'Detailed' ], ['summary', 'Summary']]} onChange={v => input('output_preference', v)} />
        {['included_scope', 'excluded_scope'].map(key => <label key={key} className="text-sm">{key.replaceAll('_', ' ')}<Textarea value={i[key].join('\n')} onChange={e => input(key, e.target.value.split('\n'))} /></label>)}
        <label className="text-sm sm:col-span-2">Notes and allowance details<Textarea value={i.notes} onChange={e => input('notes', e.target.value)} /></label>
      </div></section>
      <p role="status" className="text-sm">{notice}</p>
      {!isNew && <button disabled={busy} onClick={remove} className="text-sm text-red-700">Delete estimate</button>}
    </div><section aria-label="Estimate preview" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white lg:sticky lg:top-24">
      <header className="flex flex-wrap justify-between gap-4 bg-slate-950 p-5 text-white"><div className="min-w-0"><div className="text-xs text-slate-300">Drywall estimate</div><h2 className="break-words text-xl font-bold">{draft.project_name}</h2><div className="text-xs text-slate-300">{draft.estimate_number || 'Unsaved draft'}</div></div><div><div className="text-xs text-slate-300">Estimated price</div><strong className="text-2xl">{calculating ? 'Updating...' : calculation ? money(calculation.final_price) : '--'}</strong></div></header>
      <div className="space-y-5 p-5" aria-live="polite">{previewError && <p className="text-sm text-red-700">{previewError}</p>}
        <div className="text-sm text-slate-600">{i.prepared_by && <p>Prepared by: {i.prepared_by}</p>}{i.client_name && <p>Prepared for: {i.client_name}</p>}{i.project_location && <p>{i.project_location}</p>}</div>
        {!calculating && calculation?.sections.map((s, index) => <div key={index} className="border-b border-slate-200 pb-4"><div className="flex justify-between gap-3"><h3 className="font-bold">{s.name}</h3><strong>{money(s.subtotal)}</strong></div>{i.output_preference === 'detailed' && <><p className="my-2 text-xs text-slate-500">{s.gross_area} gross sq ft / {s.net_area} net sq ft / {s.sheets} sheets</p><details className="mb-3 text-xs text-slate-600"><summary className="cursor-pointer">How were sheets calculated?</summary>Round up (net area x layers x waste factor / sheet coverage). Purchase area: {s.purchase_area} sq ft.</details>{s.line_items.filter(line => Number(line.quantity) > 0).map((line, j) => <div key={j} className="my-2 flex justify-between gap-3 text-sm"><span>{line.name}<small className="block text-slate-500">{line.quantity} {line.unit} at {money(line.rate)}</small></span><span>{money(line.amount)}</span></div>)}</>}</div>)}
        {!calculating && calculation && <div className="space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal including adjustments and tax</span><span>{money(calculation.subtotal)}</span></div><div className="flex justify-between"><span>Discount</span><span>-{money(calculation.discount_amount)}</span></div><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(calculation.final_price)}</span></div></div>}
        {['included_scope', 'excluded_scope'].map(key => i[key].some(Boolean) && <div key={key}><h3 className="font-semibold">{key === 'included_scope' ? 'Included' : 'Excluded'}</h3>{i[key].filter(Boolean).map((line, j) => <p key={j} className="break-words text-sm text-slate-600">{line}</p>)}</div>)}
        {i.notes && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{i.notes}</p>}
      </div>
    </section></div>
  </Container></div>;
}
