import { Input, Textarea } from '../ui';

export const tradeCategories = {
  fencing: { title: 'Fencing', description: 'Estimate fence runs, materials, posts, gates, and removal.', materials: ['Wood', 'Vinyl', 'Chain-link', 'Aluminum', 'Steel', 'Composite'], sectionName: 'Fence run' },
  windows: { title: 'Windows', description: 'Estimate windows by quantity, product, installation, and finishing.', materials: ['Vinyl', 'Wood', 'Fiberglass', 'Aluminum', 'Clad wood'], sectionName: 'Window group' },
  doors: { title: 'Doors', description: 'Estimate interior and exterior doors, installation, frames, and hardware.', materials: ['Wood / composite', 'Fiberglass', 'Steel', 'Aluminum', 'Glass'], sectionName: 'Door group' },
};

export const tradeSection = category => ({ id: crypto.randomUUID(), name: tradeCategories[category].sectionName,
  material: tradeCategories[category].materials[0], product_name: '', material_supplier: 'contractor',
  material_rate: 0, labor_rate: 0, disposal: 0, notes: '', include_removal: false, removal_rate: 0,
  ...(category === 'fencing' ? { length: 0, height: 6, include_posts: false, post_count: 0, post_rate: 0,
    include_gates: false, gate_count: 0, gate_rate: 0, removal_length: 0 }
    : { count: 0, width: 0, height: 0, style: category === 'windows' ? 'Double-hung' : 'Hinged',
      installation: 'replacement', location: 'interior', include_trim: false, trim_rate: 0,
      include_frame: false, frame_rate: 0, include_hardware: false, hardware_rate: 0, removal_count: 0 }),
});

export default function TradeSectionFields({ category, s, field, toggle, update }) {
  const config = tradeCategories[category];
  const fence = category === 'fencing';
  const window = category === 'windows';
  const unit = fence ? 'linear ft' : window ? 'window' : 'door';
  const group = (key, label, children) => <div className="grid gap-4 border-t border-slate-100 pt-4 sm:col-span-2 sm:grid-cols-2">
    <div className="sm:col-span-2">{toggle(key, label)}</div>{s[key] && children}
  </div>;
  return <>
    {field('name', `${config.sectionName} name`, null, 'text')}
    <label className="min-w-0 text-sm font-medium text-slate-700"><span className="mb-1.5 block">Material</span><Input list={`trade-materials-${s.id}`} value={s.material} onChange={e => update('material', e.target.value)} /><datalist id={`trade-materials-${s.id}`}>{config.materials.map(value => <option key={value} value={value} />)}</datalist></label>
    {field('product_name', 'Product / model (optional)', null, 'text')}
    {fence ? <>{field('length', 'Fence length excluding gates (linear ft)')}{field('height', 'Fence height (ft)')}</> : <>
      {field('count', `Number of ${category}`)}
      {field('width', 'Product width (in)')}{field('height', 'Product height (in)')}
      <label className="min-w-0 text-sm font-medium text-slate-700"><span className="mb-1.5 block">Style / type</span><Input list={`trade-styles-${s.id}`} value={s.style} onChange={e => update('style', e.target.value)} /><datalist id={`trade-styles-${s.id}`}>{(window ? ['Double-hung', 'Casement', 'Sliding', 'Fixed', 'Bay / bow'] : ['Hinged', 'Sliding', 'French', 'Bifold', 'Pocket', 'Entry']).map(value => <option key={value} value={value} />)}</datalist></label>
      {field('installation', 'Installation type', [['replacement', 'Replacement'], ['new', 'New opening / construction']])}
      {!window && field('location', 'Door location', [['interior', 'Interior'], ['exterior', 'Exterior']])}
    </>}
    {field('material_supplier', fence ? 'Fence infill supplier' : 'Product supplier', [['contractor', 'Contractor'], ['client', 'Customer']])}
    {field('material_rate', `${fence ? 'Fence infill material' : 'Product price'} / ${unit} ($)`)}
    {field('labor_rate', `Installation labor / ${unit} ($)`)}
    {fence ? <>
      {group('include_posts', 'Include posts and setting', <>{field('post_count', 'Post quantity')}{field('post_rate', 'Installed price / post ($)')}</>)}
      {group('include_gates', 'Include gates', <>{field('gate_count', 'Gate quantity')}{field('gate_rate', 'Installed price / gate including hardware ($)')}</>)}
    </> : <>
      {group('include_trim', 'Include trim and finishing', field('trim_rate', `Installed trim / ${unit} ($)`))}
      {group('include_frame', 'Include frame or opening repairs', field('frame_rate', `Frame / opening work per ${unit} ($)`))}
      {group('include_hardware', 'Include additional hardware', field('hardware_rate', `Installed hardware / ${unit} ($)`))}
    </>}
    {group('include_removal', 'Include existing removal', <>{field(fence ? 'removal_length' : 'removal_count', fence ? 'Existing fence to remove (linear ft)' : `Existing ${category} to remove`)}{field('removal_rate', `Removal / ${unit} ($)`)}</>)}
    {field('disposal', 'Section disposal allowance ($)')}
    <p className="text-xs leading-5 text-slate-500 sm:col-span-2">{fence
      ? 'Fence length excludes gate openings. Enter rates for the selected height. Infill rates exclude separately priced posts and gates. Customer supply excludes only infill material; posts and gates retain their installed prices.'
      : 'Group matching products and sizes together. Dimensions describe the product; prices are per unit. Adjust labor for access and opening complexity. Add frame, trim, and hardware only when not already included. Customer supply excludes only the main product price.'}</p>
    <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2"><span className="mb-1.5 block">Section notes</span><Textarea value={s.notes} maxLength={1000} onChange={e => update('notes', e.target.value)} /></label>
  </>;
}
