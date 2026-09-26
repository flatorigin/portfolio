import { PLUMBING_SERVICES } from "./plumbingPricing2026_27";
import { newElectricalDraft, estimateDraftTotal } from "./electricalBundles2026_27";
export { estimateDraftTotal };
const line = (name, price, detail, quantity = 1, unit = "project", optional = false) => ({ id: `line-${crypto.randomUUID()}`, name, quantity, unit, unit_price: price, homeowner_unit_price: price, detail, required: !optional, included: !optional });
export const createProjectSetup = () => ({ id: `project-${crypto.randomUUID()}`, service_id: "project-setup", name: "Shared visit and setup", location: "Whole project", notes: "Charged once across selected work.", line_items: [line("Visit, scope confirmation and mobilization", 125, "One ordinary scheduled visit. Adjust if credited or already covered by a service."), line("Work-area protection and basic cleanup", 0, "Included; finish restoration remains separate.")] });
export function createPlumbingProject(id) {
  const service = PLUMBING_SERVICES.find(item => item.id === id);
  if (!service) return null;
  const measured = service.unit === "linear ft";
  const quantity = measured ? 10 : 1;
  let lines;
  if (service.mode === "diagnosis") lines = [line(service.title, service.low, "Diagnosis and findings only. Repair work requires a separate confirmed scope.")];
  else if (service.mode === "site") lines = [line(service.title, service.low, measured ? "Provisional 10 ft quantity: replace with measured length. Excavation/access and restoration need confirmation." : "Preliminary allowance only. Plumber must confirm scope, equipment, access and quantities.", quantity, service.unit)];
  else if (service.mode === "clearing") lines = [line("Accessible drain clearing and flow check", service.low, "One accessible drain. Camera inspection, repeat visits and pipe repairs excluded.")];
  else {
    const equipment = service.mode === "equipment" ? Math.round(service.low * .5) : 0;
    const parts = Math.round(service.low * .15);
    const removal = Math.round(service.low * .1);
    lines = [line("Isolate water, disconnect and remove existing work", removal, "Ordinary accessible removal; adjust for new installations."), line("Pipe connections, fittings, seals and repair parts", parts, "Plumber confirms compatible materials and sizes."), ...(equipment ? [line("Standard equipment allowance", equipment, "Adjust to selected model; set to zero when homeowner supplies equipment.")] : []), line("Installation, reconnection and leak/flow testing", service.low - equipment - parts - removal, service.note), line("Additional access or demolition", 200, "Enable only when required; finish restoration is separate.", 1, "allowance", true)];
  }
  return { id: `project-${crypto.randomUUID()}`, service_id: id, name: service.title, location: "", notes: service.note, line_items: lines };
}
export function newPlumbingDraft() {
  const draft = newElectricalDraft();
  return { ...draft, project_name: "Residential plumbing scope", inputs: { ...draft.inputs, notes: "Provisional planning allowances. Permits, township fees, filing, utility coordination and finish restoration excluded." } };
}
