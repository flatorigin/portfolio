import { Input, Textarea } from '../ui';

const extras = [
  ['preparation', 'Grinding / surface preparation', 'sq ft'],
  ['removal', 'Existing coating removal', 'sq ft'],
  ['cracks', 'Crack / joint repair', 'linear ft'],
  ['patching', 'Concrete patching', 'sq ft'],
  ['moisture', 'Moisture mitigation', 'sq ft'],
  ['flakes', 'Decorative flakes / quartz', 'sq ft'],
  ['traction', 'Slip-resistant additive', 'sq ft'],
  ['cove', 'Cove / stem-wall coating', 'linear ft'],
];
export const garageCoatingSection = () => ({
  id: crypto.randomUUID(), name: 'Garage floor', material: 'Industrial-grade polyaspartic',
  product_name: '', system_description: '', notes: '', measurement: 'area', area: 0, length: 0, width: 0,
  pricing: 'separate', material_supplier: 'contractor', material_rate: 0, labor_rate: 0,
  installed_rate: 0, waste: 0, disposal: 0,
  ...Object.fromEntries(extras.flatMap(([key]) => [[`include_${key}`, false], [`${key}_quantity`, 0], [`${key}_rate`, 0]])),
});

export default function GarageCoatingSectionFields({ s, field, toggle, update, result, calculating }) {
  return <>
    {field('name', 'Floor section name', null, 'text')}
    <label className="min-w-0 text-sm font-medium text-slate-700"><span className="mb-1.5 block">Coating material / system</span><Input list={`coating-materials-${s.id}`} value={s.material} onChange={e => update('material', e.target.value)} placeholder="Choose or type a coating system" /><datalist id={`coating-materials-${s.id}`}>{['Industrial-grade polyaspartic', 'Polyaspartic', 'Epoxy', 'Polyurea', 'Polyurethane', 'Epoxy base / polyaspartic topcoat', 'Concrete sealer'].map(name => <option key={name} value={name} />)}</datalist></label>
    {field('product_name', 'Manufacturer / product (optional)', null, 'text')}
    {field('system_description', 'System specification / coats', null, 'text')}
    <p className="text-xs leading-5 text-slate-500 sm:col-span-2">Describe the primer, base coats, topcoats, and finish included. Enter rates for the complete selected system; coats are not multiplied again. Use the selected product specification to define its grade and coverage.</p>
    {field('measurement', 'Area method', [['area', 'Enter square feet'], ['dimensions', 'Length x width']])}
    {s.measurement === 'area' ? field('area', 'Floor area to coat (sq ft)') : <>{field('length', 'Floor length (ft)')}{field('width', 'Floor width (ft)')}</>}
    {field('pricing', 'Pricing method', [['separate', 'Separate materials and labor'], ['installed', 'Complete-system installed rate']])}
    {s.pricing === 'installed' ? <>
      {field('installed_rate', 'Complete coating system installed / floor sq ft ($)')}
      <p className="text-xs leading-5 text-slate-500 sm:col-span-2">The installed rate includes coating materials, material waste, and application labor. Add preparation and other work below only when excluded from this rate.</p>
    </> : <>
      {field('material_supplier', 'Coating material supplier', [['contractor', 'Contractor'], ['client', 'Customer']])}
      {field('material_rate', 'Complete coating system materials / sq ft ($)')}
      {field('waste', 'Coating material waste (%)')}
      {field('labor_rate', 'Complete system application labor / floor sq ft ($)')}
      <p className="text-xs leading-5 text-slate-500 sm:col-span-2">Waste applies only to coating materials. Customer supply excludes only the coating material price; labor and enabled extras remain charged.</p>
    </>}
    <div className="sm:col-span-2"><h3 className="font-semibold">Preparation and optional work</h3><p className="mt-1 text-xs leading-5 text-slate-500">Enable only work excluded from the coating-system rates. Each item uses its own quantity and installed price, including its materials and labor.</p></div>
    {extras.map(([key, label, unit]) => <div key={key} className="grid gap-4 border-t border-slate-100 pt-4 sm:col-span-2 sm:grid-cols-2">
      <div className="sm:col-span-2">{toggle(`include_${key}`, label)}</div>
      {s[`include_${key}`] && <>{field(`${key}_quantity`, `${label} quantity (${unit})`)}{field(`${key}_rate`, `${label} installed / ${unit} ($)`)}</>}
    </div>)}
    {field('disposal', 'Section disposal allowance ($)')}
    <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2"><span className="mb-1.5 block">Section notes</span><Textarea value={s.notes} maxLength={1000} onChange={e => update('notes', e.target.value)} placeholder="Concrete condition, preparation method, finish/color, product assumptions, or access" /></label>
    {!calculating && result && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 sm:col-span-2">{result.quantity_summary} Optional work uses its own quantities.</div>}
  </>;
}
