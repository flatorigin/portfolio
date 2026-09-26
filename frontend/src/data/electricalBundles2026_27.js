import { ELECTRICAL_SERVICES } from "./electricalPricing2026_27";

const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
const round = value => Math.max(0, Math.round(Number(value || 0) * 100) / 100);

const line = (name, quantity, unit, unitPrice, detail, options = {}) => ({
  id: uid("line"),
  name,
  quantity,
  unit,
  unit_price: round(unitPrice),
  homeowner_unit_price: round(unitPrice),
  detail,
  required: options.required ?? true,
  included: options.included ?? true,
});

export const createProjectSetup = () => ({
  id: uid("project"),
  service_id: "project-setup",
  name: "Project visit and scope confirmation",
  location: "Whole project",
  notes: "One mobilization charge is shared across all selected electrical work.",
  line_items: [
    line("Home visit and scope confirmation", 1, "visit", 0, "Assumes the visit is credited when the electrician is hired."),
    line("Mobilization and service minimum", 1, "project", 125, "Travel, vehicle, ordinary setup and initial site protection."),
    line("Final testing, labeling and basic cleanup", 1, "project", 0, "Included in the minimum project scope."),
  ],
});

const has = (service, pattern) => pattern.test(`${service.id} ${service.title} ${service.keywords}`);

function replacementBundle(service) {
  const demo = round(service.low * 0.15);
  const material = round(service.low * 0.25);
  const labor = round(service.low - demo - material);
  return [
    line("Safe shutdown and existing-device removal", 1, "each", demo, "Remove the existing device and inspect the box and conductors."),
    line(`${service.title} — standard material allowance`, 1, "each", material, "Contractor-grade device or ordinary mounting hardware."),
    line("Installation and electrical connections", 1, "each", labor, "Connect, secure, energize and function-test the replacement."),
  ];
}

function circuitBundle(service) {
  const ev = service.id.startsWith("ev-");
  const highDraw = ev || has(service, /240|dryer|range|oven|induction|hot.tub|mini.split|water.heater|sauna/);
  const cable = ev ? "6 AWG copper THHN/THWN-2 in conduit or approved 6/2 cable" : highDraw ? "Copper branch-circuit cable sized to the equipment load" : "12/2 copper NM-B branch-circuit cable";
  const feet = ev ? 30 : 20;
  const cableRate = ev ? 7 : highDraw ? 5 : 2.5;
  const breakerPrice = ev ? 150 : highDraw ? 120 : 75;
  const devicePrice = Math.max(50, round(service.low * 0.16));
  const fixed = breakerPrice + feet * cableRate + devicePrice;
  const labor = Math.max(100, round(service.low - fixed));
  return [
    line("Panel load and circuit-path confirmation", 1, "project", 0, "Confirm capacity, breaker compatibility and the practical cable route."),
    line(highDraw ? "Two-pole circuit breaker" : "Single-pole circuit breaker", 1, "each", breakerPrice, "Listed breaker sized for the circuit and equipment."),
    line(cable, feet, "linear ft", cableRate, "Default planning length; electrician confirms conductor and raceway requirements."),
    line("Boxes, connectors, fasteners and ordinary fittings", 1, "allowance", devicePrice, "Standard small materials required to complete the circuit."),
    line("Cable routing, termination and equipment connection", 1, "project", labor, "Accessible route with ordinary mounting and final electrical testing."),
    line("Finished-wall wire fishing", 0, "run", 250, "Enable and set quantity when conductors must be fished through closed walls or ceilings.", { required: false, included: false }),
    line("Existing-device demolition", 0, "each", 150, "Enable when an old circuit, receptacle or equipment connection must be removed.", { required: false, included: false }),
  ];
}

function panelBundle(service) {
  const material = round(service.low * 0.34);
  const demo = round(service.low * 0.12);
  const grounding = round(service.low * 0.12);
  const labor = round(service.low - material - demo - grounding);
  return [
    line("Service assessment, load calculation and utility coordination", 1, "project", 0, "Confirm service size, equipment location and utility requirements."),
    line("Existing panel/service equipment removal", 1, "project", demo, "Safe disconnection and ordinary demolition."),
    line("Panel, main equipment and standard breakers", 1, "allowance", material, "Contractor-grade listed equipment; specialty breakers are adjusted separately."),
    line("Grounding, bonding, labels and service fittings", 1, "allowance", grounding, "Ordinary code-required grounding and identification materials."),
    line("Installation, circuit transfer and testing", 1, "project", labor, "Mount, terminate, label, energize and test the service equipment."),
  ];
}

function lightingBundle(service) {
  const material = round(service.low * 0.3);
  const labor = round(service.low * 0.55);
  const demo = round(service.low - material - labor);
  return [
    line("Existing fixture/device removal", 1, "each", demo, "Ordinary demolition and box inspection."),
    line("Electrical box, support and standard connection materials", 1, "each", material, "Fixture itself is excluded unless the project title says equipment is included."),
    line("Mounting, wiring, switching check and testing", 1, "each", labor, "Standard-height accessible installation."),
    line("14/2 copper NM-B cable for a new lighting run", 0, "linear ft", 2.25, "Enable when the project needs new cable rather than an existing box.", { required: false, included: false }),
    line("Finished-wall wire fishing", 0, "run", 250, "Enable for closed walls or ceilings.", { required: false, included: false }),
  ];
}

function genericBundle(service) {
  const material = round(service.low * 0.3);
  const labor = round(service.low * 0.7);
  return [
    line("Site verification and safe work setup", 1, "project", 0, "Confirm existing conditions before work begins."),
    line("Standard materials and small parts", 1, "allowance", material, "Lowest ordinary material allowance for the described service."),
    line("Installation labor and testing", 1, "project", labor, "Accessible conditions during normal working hours."),
    line("Demolition or removal", 0, "allowance", round(service.low * 0.15), "Enable if existing work must be removed.", { required: false, included: false }),
    line("Finished-wall wire fishing", 0, "run", 250, "Enable when concealed routing is required.", { required: false, included: false }),
  ];
}

export function createElectricalProject(serviceId) {
  const service = ELECTRICAL_SERVICES.find(item => item.id === serviceId);
  if (!service) return null;
  let lineItems;
  if (has(service, /panel|service.200|service.400|meter.socket|service.cable|service.mast/)) lineItems = panelBundle(service);
  else if (has(service, /replace|repair/) && !has(service, /panel|service|rewire/)) lineItems = replacementBundle(service);
  else if (has(service, /circuit|240|dryer|range|oven|induction|water.heater|mini.split|sump|well|hot.tub|pool|ev-|charger|gate|subpanel/)) lineItems = circuitBundle(service);
  else if (has(service, /light|fixture|fan|chandelier|dimmer|switch/)) lineItems = lightingBundle(service);
  else lineItems = genericBundle(service);
  return {
    id: uid("project"),
    service_id: service.id,
    name: service.title,
    location: "",
    notes: service.note,
    line_items: lineItems,
  };
}

export const newElectricalDraft = () => ({
  project_name: "Residential electrical scope",
  issue_date: new Date().toLocaleDateString("en-CA"),
  valid_until: "",
  status: "draft",
  contractor_notes: "",
  inputs: {
    projects: [],
    prepared_by: "",
    client_name: "",
    project_location: "",
    notes: "Permit, inspection, utility and township fees are excluded.",
    included_scope: [],
    excluded_scope: ["Permit, inspection, utility and township fees", "Drywall, plaster and paint restoration unless itemized"],
    overhead: 0,
    profit: 0,
    profit_method: "markup",
    tax: 0,
    discount: 0,
    discount_type: "percent",
    minimum: 0,
    allowances: 0,
    adjustment: 0,
    output_preference: "detailed",
  },
});

export function estimateDraftTotal(projects) {
  return projects.reduce((projectTotal, project) => projectTotal + project.line_items.reduce((lineTotal, item) => {
    return lineTotal + (item.included ? Number(item.quantity || 0) * Number(item.unit_price || 0) : 0);
  }, 0), 0);
}
