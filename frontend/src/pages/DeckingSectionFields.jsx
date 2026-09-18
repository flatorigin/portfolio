import { Input, Textarea, SymbolIcon } from '../ui';

export const deckingSection = () => ({ id: crypto.randomUUID(), name: 'Main deck', material: 'Pressure-treated wood', product_name: '', measurement: 'area', area: 0, length: 0, width: 0, waste: 10, material_rate: 0, material_supplier: 'contractor', labor_rate: 0, include_framing: false, framing_type: 'Pressure-treated lumber', framing_rate: 0, include_railings: false, railing_type: 'Wood', railing_length: 0, railing_rate: 0, include_stairs: false, stair_count: 0, stair_rate: 0, include_demolition: false, demolition_area: 0, demolition_rate: 0, disposal: 0, extras: [], notes: '' });

const extras = { 'Footings / foundations': 'each', 'Hardware / fasteners': 'allowance', 'Fascia / skirting': 'linear ft', 'Stain / sealer': 'sq ft', 'Lighting': 'each', 'Permits / engineering': 'allowance', 'Custom item': 'each' };

export default function DeckingSectionFields({ s, field, toggle, update, result, calculating, Field }) {
  return <>
    {field('name', 'Deck / section name', null, 'text')}
    <label className="min-w-0 text-sm font-medium text-slate-700"><span className="mb-1.5 block">Decking material</span><Input list={`decking-materials-${s.id}`} value={s.material} onChange={e => update('material', e.target.value)} /><datalist id={`decking-materials-${s.id}`}>{['Pressure-treated wood', 'Composite', 'PVC', 'Cedar', 'Hardwood', 'Aluminum'].map(v => <option key={v} value={v} />)}</datalist></label>
    {field('product_name', 'Product / finish (optional)', null, 'text')}
    {field('measurement', 'Area method', [['area', 'Enter square feet'], ['dimensions', 'Length x width']])}
    {s.measurement === 'dimensions' ? <>{field('length', 'Deck length (ft)')}{field('width', 'Deck width (ft)')}</> : field('area', 'Deck area (sq ft)')}
    {field('waste', 'Deck-board waste (%)')}
    {field('material_rate', 'Deck-board material / sq ft ($)')}
    {field('material_supplier', 'Deck-board supplier', [['contractor', 'Contractor'], ['client', 'Customer']])}
    {field('labor_rate', 'Deck-board installation / deck sq ft ($)')}
    <div className="grid gap-4 border-t border-slate-100 pt-4 sm:col-span-2 sm:grid-cols-2">
    <div className="sm:col-span-2">{toggle('include_framing', 'Include framing')}</div>
    {s.include_framing && <>{field('framing_type', 'Framing material / scope', null, 'text')}{field('framing_rate', 'Installed framing / deck sq ft ($)')}</>}
    </div>
    <div className="grid gap-4 border-t border-slate-100 pt-4 sm:col-span-2 sm:grid-cols-2">
    <div className="sm:col-span-2">{toggle('include_railings', 'Include railings')}</div>
    {s.include_railings && <>{field('railing_type', 'Railing material / style', null, 'text')}{field('railing_length', 'Total railing length including stairs (linear ft)')}{field('railing_rate', 'Installed railing / linear ft ($)')}</>}
    </div>
    <div className="grid gap-4 border-t border-slate-100 pt-4 sm:col-span-2 sm:grid-cols-2">
    <div className="sm:col-span-2">{toggle('include_stairs', 'Include stairs')}</div>
    {s.include_stairs && <>{field('stair_count', 'Number of stair treads')}{field('stair_rate', 'Installed stair assembly / tread ($)')}</>}
    </div>
    <div className="grid gap-4 border-t border-slate-100 pt-4 sm:col-span-2 sm:grid-cols-2">
    <div className="sm:col-span-2">{toggle('include_demolition', 'Include demolition')}</div>
    {s.include_demolition && <>{field('demolition_area', 'Existing deck area to demolish (sq ft)')}{field('demolition_rate', 'Demolition / sq ft ($)')}</>}
    </div>
    {field('disposal', 'Section disposal allowance ($)')}
    <p className="text-xs leading-5 text-slate-500 sm:col-span-2">Framing, railing, and stair rates include their materials and labor. Stair pricing excludes railings; enter stair rails in the railing length. Footings, hardware, and permits are separate unless included in your entered rates. Customer-supplied deck boards exclude only the board purchase cost.</p>
    <div className="min-w-0 space-y-4 border-t border-slate-200 pt-4 sm:col-span-2">
      <h3 className="font-semibold">Decking extras</h3>
      {(s.extras || []).map((extra, index) => {
        const change = (key, value) => update('extras', s.extras.map((row, j) => j === index ? { ...row, [key]: value } : row));
        return <div key={extra.id} className="grid min-w-0 gap-3 border-b border-slate-100 pb-4 sm:grid-cols-2">
          <Field label="Extra name" type="text" value={extra.name} onChange={v => change('name', v)} />
          <Field label="Extra unit" value={extra.unit} options={['linear ft', 'sq ft', 'each', 'allowance'].map(v => [v, v])} onChange={v => change('unit', v)} />
          <Field label="Extra quantity" value={extra.quantity} onChange={v => change('quantity', v)} />
          <Field label="Extra installed price / unit ($)" value={extra.rate} onChange={v => change('rate', v)} />
          <button type="button" aria-label={`Remove decking extra ${index + 1}`} title="Remove extra" onClick={() => update('extras', s.extras.filter((_, j) => j !== index))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"><SymbolIcon name="delete" /></button>
        </div>;
      })}
      <label className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">Add decking extra</span><select className="h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm" value="" onChange={e => { if (e.target.value) update('extras', [...s.extras, { id: crypto.randomUUID(), name: e.target.value, unit: extras[e.target.value], quantity: 0, rate: 0 }]); }}><option value="">Choose an item...</option>{Object.keys(extras).map(v => <option key={v} value={v}>{v}</option>)}</select></label>
    </div>
    <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2"><span className="mb-1.5 block">Decking section notes</span><Textarea value={s.notes} maxLength={1000} onChange={e => update('notes', e.target.value)} /></label>
    {!calculating && result && <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600 sm:col-span-2">{result.area} deck sq ft; {result.purchase_area} deck-board material sq ft including waste. Deck installation and framing use actual deck area. This estimate does not size structural members or verify code compliance.</div>}
  </>;
}
