import { estimateEvCharger, formatPriceRange } from "../data/electricalPricing2026_27";
export default function ElectricalEvConfiguration({ project, onChange, disabled }) {
  const options = project.ev_options;
  return <details open className="border-t border-stone-200 bg-stone-50/50 p-4">
    <summary className="cursor-pointer text-sm font-semibold text-stone-900">Configure Level 2 EV charger</summary>
    {!options ? <p className="mt-3 text-sm text-stone-600">This estimate uses manually itemized pricing. { !disabled && <button type="button" onClick={() => onChange({})} className="underline">Configure and recalculate this project</button>}</p> : <>
      <p className="mt-2 text-xs text-stone-500">Changing these settings recalculates the charger allowances below. Adjust individual prices after configuring.</p>
      <fieldset disabled={disabled} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-stone-600">Distance (ft)<input aria-label="EV wire distance in feet" type="number" min="0" max="300" value={options.distance} onChange={event => onChange({ distance: Math.max(0, Math.min(300, Number(event.target.value))) })} className="mt-1 block h-10 w-full rounded-lg border border-stone-300 bg-white px-3" /></label>
        {[["route", "Wire route", [["open", "Open / unfinished space"], ["finished", "Finished walls or ceilings"], ["exterior", "Exterior conduit"], ["trench", "Underground trench"]]], ["panel", "Panel capacity", [["unknown", "Needs electrician confirmation"], ["ready", "Capacity and breaker space available"], ["space", "Needs panel space / subpanel"], ["managed", "Needs load management"], ["upgrade", "Needs service upgrade"]]], ["connection", "Connection type", [["hardwired", "Hardwire"], ["receptacle", "NEMA 14-50"]]]].map(([key, title, choices]) => <label key={key} className="text-sm text-stone-600">{title}<select value={options[key]} onChange={event => onChange({ [key]: event.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-stone-300 bg-white px-3">{choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}
        {[["detached", "Detached garage"], ["includeCharger", "Include charger equipment"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={options[key]} onChange={event => onChange({ [key]: event.target.checked })} />{label}</label>)}
      </fieldset>
      <p className="mt-3 text-xs text-stone-600">Planning range: {formatPriceRange(estimateEvCharger(options).low, estimateEvCharger(options).high)}. Shared visit charge and permits excluded. {options.panel === "unknown" && "An electrician must confirm panel capacity; an upgrade may add cost."}</p>
    </>}
  </details>;
}
