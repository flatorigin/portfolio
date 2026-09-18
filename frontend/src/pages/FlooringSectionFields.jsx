import { Input, Textarea, SymbolIcon } from '../ui';

export const flooringSection = () => ({ id: crypto.randomUUID(), name: 'Main room', material: 'Luxury vinyl', product_name: '', brand_model: '', product_link: '', measurement: 'area', area: 0, length: 0, width: 0, waste: 10, pricing: 'sqft', material_rate: 0, coverage: 0, package_price: 0, material_supplier: 'contractor', labor_rate: 0, remove_existing: false, removal_override: false, removal_area: 0, removal_rate: 0, preparation: 0, disposal: 0, extras: [], notes: '' });

const extraTypes = { 'Underlayment / moisture barrier': 'sq ft', 'Baseboards / shoe molding': 'linear ft', 'Transitions / thresholds': 'each', 'Stairs': 'step', 'Custom item': 'each' };

export default function FlooringSectionFields({ s, field, toggle, update, result, calculating, Field }) {
  return <>
    {field('name', 'Room / area name', null, 'text')}
    {field('material', 'Material category', ['Luxury vinyl', 'Laminate', 'Engineered wood', 'Solid hardwood', 'Tile', 'Carpet', 'Other'].map(v => [v, v]))}
    {field('product_name', 'Product name (optional)', null, 'text')}
    {field('brand_model', 'Brand / model (optional)', null, 'text')}
    <div className="sm:col-span-2">{field('product_link', 'Product link (optional)', null, 'url')}</div>
    {field('measurement', 'Area method', [['area', 'Enter square feet'], ['dimensions', 'Length x width']])}
    {s.measurement === 'area' ? field('area', 'Floor area (sq ft)') : <>{field('length', 'Room length (ft)')}{field('width', 'Room width (ft)')}</>}
    {field('waste', 'Material waste (%)')}
    {field('pricing', 'Material pricing', [['sqft', 'Per square foot'], ['package', 'Per box / package']])}
    {s.pricing === 'package' ? <>{field('coverage', 'Coverage per package (sq ft)')}{field('package_price', 'Price per package ($)')}</> : field('material_rate', 'Material price / sq ft ($)')}
    {field('material_supplier', 'Flooring supplier', [['contractor', 'Contractor'], ['client', 'Customer']])}
    {field('labor_rate', 'Installation labor / floor sq ft ($)')}
    {toggle('remove_existing', 'Remove existing flooring')}
    {s.remove_existing && <>
      {field('removal_rate', 'Removal / sq ft ($)')}
      {toggle('removal_override', 'Use a different removal area')}
      {s.removal_override && field('removal_area', 'Removal area (sq ft)')}
    </>}
    {field('preparation', 'Subfloor preparation / leveling allowance ($)')}
    {field('disposal', 'Section disposal allowance ($)')}
    <div className="min-w-0 space-y-4 border-t border-slate-200 pt-4 sm:col-span-2">
      <h3 className="font-semibold">Flooring extras</h3>
      {(s.extras || []).map((extra, index) => {
        const change = (key, value) => update('extras', s.extras.map((row, j) => j === index ? { ...row, [key]: value } : row));
        return <div key={extra.id} className="grid min-w-0 gap-3 border-b border-slate-100 pb-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-medium text-slate-700"><span className="mb-1.5 block">Extra name</span><Input list={`floor-extras-${s.id}`} value={extra.name} onChange={e => change('name', e.target.value)} /></label>
          <Field label="Extra unit" value={extra.unit} options={['linear ft', 'sq ft', 'each', 'step', 'allowance'].map(v => [v, v])} onChange={v => change('unit', v)} />
          <Field label="Extra quantity" value={extra.quantity} onChange={v => change('quantity', v)} />
          <Field label="Extra installed price / unit ($)" value={extra.rate} onChange={v => change('rate', v)} />
          <button type="button" aria-label={`Remove flooring extra ${index + 1}`} title="Remove extra" onClick={() => update('extras', s.extras.filter((_, j) => j !== index))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50"><SymbolIcon name="delete" /></button>
        </div>;
      })}
      <datalist id={`floor-extras-${s.id}`}>{Object.keys(extraTypes).map(v => <option key={v} value={v} />)}</datalist>
      <label className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">Add flooring extra</span><select className="h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm" value="" onChange={e => { if (e.target.value) update('extras', [...(s.extras || []), { id: crypto.randomUUID(), name: e.target.value, unit: extraTypes[e.target.value], quantity: 0, rate: 0 }]); }}><option value="">Choose an item...</option>{Object.keys(extraTypes).map(v => <option key={v} value={v}>{v}</option>)}</select></label>
    </div>
    <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2"><span className="mb-1.5 block">Flooring section notes</span><Textarea value={s.notes} maxLength={1000} onChange={e => update('notes', e.target.value)} /></label>
    {!calculating && result && <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600 sm:col-span-2">{result.area} floor sq ft; {result.purchase_area} material sq ft including waste.{s.pricing === 'package' && ` Order ${result.packages} whole packages covering ${result.ordered_coverage} sq ft.`} Labor uses floor area, not material waste. Extras are separately priced.</div>}
  </>;
}
