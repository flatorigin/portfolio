import { Input, Textarea, SymbolIcon } from '../ui';

export const sidingSection = () => ({ id: crypto.randomUUID(), name: 'Exterior wall', material: 'Vinyl', product_name: '', measurement: 'gross', area: 0, width: 0, height: 0, openings: 0, waste: 10, pricing: 'sqft', material_rate: 0, material_supplier: 'contractor', labor_rate: 0, remove_existing: false, removal_override: false, removal_area: 0, removal_rate: 0, preparation: 0, disposal: 0, extras: [], notes: '' });

const extras = { 'House wrap / weather barrier': 'sq ft', 'Exterior insulation': 'sq ft', 'Trim / corner boards': 'linear ft', 'Soffit': 'sq ft', 'Fascia': 'linear ft', 'Flashing': 'linear ft', 'Access / scaffolding': 'allowance', 'Custom item': 'each' };

export default function SidingSectionFields({ s, field, toggle, update, result, calculating, Field }) {
  return <>
    {field('name', 'Wall / elevation name', null, 'text')}
    <label className="min-w-0 text-sm font-medium text-slate-700"><span className="mb-1.5 block">Siding material</span><Input list={`siding-materials-${s.id}`} value={s.material} onChange={e => update('material', e.target.value)} /><datalist id={`siding-materials-${s.id}`}>{['Vinyl', 'Fiber cement', 'Engineered wood', 'Wood', 'Metal', 'Stucco', 'Stone veneer'].map(v => <option key={v} value={v} />)}</datalist></label>
    {field('product_name', 'Product / finish (optional)', null, 'text')}
    {field('measurement', 'Area method', [['gross', 'Gross wall area'], ['net', 'Net area (openings already excluded)'], ['rectangle', 'Rectangle: width x height'], ['triangle', 'Gable: width x height / 2']])}
    {['rectangle', 'triangle'].includes(s.measurement) ? <>{field('width', 'Wall / gable width (ft)')}{field('height', s.measurement === 'triangle' ? 'Gable rise above eave (ft)' : 'Wall height (ft)')}</> : field('area', s.measurement === 'net' ? 'Net siding area (sq ft)' : 'Gross wall area (sq ft)')}
    {s.measurement !== 'net' && field('openings', 'Windows / doors to deduct (sq ft)')}
    {field('waste', 'Material waste (%)')}
    {field('pricing', 'Material rate unit', [['sqft', 'Per square foot'], ['square', 'Per square (100 sq ft)']])}
    {field('material_rate', s.pricing === 'square' ? 'Material price / square ($)' : 'Material price / sq ft ($)')}
    {field('material_supplier', 'Siding supplier', [['contractor', 'Contractor'], ['client', 'Customer']])}
    {field('labor_rate', 'Installation labor / net sq ft ($)')}
    {toggle('remove_existing', 'Remove existing siding')}
    {s.remove_existing && <>{field('removal_rate', 'Removal / net sq ft ($)')}{toggle('removal_override', 'Use a different removal area')}{s.removal_override && field('removal_area', 'Removal area (sq ft)')}</>}
    {field('preparation', 'Wall preparation allowance ($)')}
    {field('disposal', 'Section disposal allowance ($)')}
    <div className="min-w-0 space-y-4 border-t border-slate-200 pt-4 sm:col-span-2">
      <h3 className="font-semibold">Siding extras</h3>
      {(s.extras || []).map((extra, index) => {
        const change = (key, value) => update('extras', s.extras.map((row, j) => j === index ? { ...row, [key]: value } : row));
        return <div key={extra.id} className="grid min-w-0 gap-3 border-b border-slate-100 pb-4 sm:grid-cols-2">
          <Field label="Extra name" type="text" value={extra.name} onChange={v => change('name', v)} />
          <Field label="Extra unit" value={extra.unit} options={['linear ft', 'sq ft', 'each', 'allowance'].map(v => [v, v])} onChange={v => change('unit', v)} />
          <Field label="Extra quantity" value={extra.quantity} onChange={v => change('quantity', v)} />
          <Field label="Extra installed price / unit ($)" value={extra.rate} onChange={v => change('rate', v)} />
          <button type="button" aria-label={`Remove siding extra ${index + 1}`} title="Remove extra" onClick={() => update('extras', s.extras.filter((_, j) => j !== index))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"><SymbolIcon name="delete" /></button>
        </div>;
      })}
      <label className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">Add siding extra</span><select className="h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm" value="" onChange={e => { if (e.target.value) update('extras', [...s.extras, { id: crypto.randomUUID(), name: e.target.value, unit: extras[e.target.value], quantity: 0, rate: 0 }]); }}><option value="">Choose an item...</option>{Object.keys(extras).map(v => <option key={v} value={v}>{v}</option>)}</select></label>
    </div>
    <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2"><span className="mb-1.5 block">Siding section notes</span><Textarea value={s.notes} maxLength={1000} onChange={e => update('notes', e.target.value)} /></label>
    {!calculating && result && <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600 sm:col-span-2">{result.area} net siding sq ft; {result.purchase_area} material sq ft ({result.squares} squares) including waste. Installation uses net area. Extras are separately priced.</div>}
  </>;
}
