import { estimateEvCharger } from "./electricalPricing2026_27";
export const isEvInstallation = id => ["ev-near", "ev-typical", "ev-outdoor"].includes(id);
export function configureEvProject(project, changes = {}) {
  const options = { distance: project.service_id === "ev-near" ? 10 : 30, route: project.service_id === "ev-outdoor" ? "exterior" : "open", panel: "unknown", connection: "hardwired", detached: project.service_id === "ev-outdoor", includeCharger: false, ...project.ev_options, ...changes };
  const estimate = estimateEvCharger(options);
  const lines = estimate.breakdown.map((entry, index) => {
    const key = index === 0 ? "base" : /additional ft/.test(entry.label) ? "distance" : /receptacle/.test(entry.label) ? "receptacle" : /Detached/.test(entry.label) ? "detached" : /charging equipment/.test(entry.label) ? "equipment" : "panel";
    const id = `${project.id}-ev-${key}`;
    const existing = project.line_items.find(item => item.id === id);
    return { id, name: entry.label, quantity: 1, unit: "project", unit_price: entry.low, homeowner_unit_price: existing?.homeowner_unit_price ?? entry.low, required: true, included: true, detail: index === 0 ? "Breaker, load confirmation, cable/conduit, mounting, connections and testing. Electrician confirms conductor size and equipment compatibility." : "Starting allowance for the selected conditions; electrician may adjust." };
  });
  return { ...project, ev_options: options, line_items: [...lines, ...project.line_items.filter(item => !item.id.startsWith(`${project.id}-ev-`) && item.id.startsWith("line-custom-"))] };
}
