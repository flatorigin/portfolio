export const ELECTRICAL_PRICEBOOK_META = {
  version: "2026–27",
  region: "Media and Philadelphia Main Line, Pennsylvania",
  effectiveFrom: "2026-09-01",
  effectiveThrough: "2027-12-31",
  basis: "Typical homeowner-facing range for a licensed and insured residential electrician",
  sources: [
    { name: "Media Borough unified fee schedule", url: "https://www.mediaborough.com/DocumentCenter/View/1924/Resolution-2024-50-unified_fee_schedule" },
    { name: "Lower Merion Township building fee schedule", url: "https://www.lowermerion.org/home/showpublisheddocument/13278/638666548152300000" },
    { name: "HomeGuide 2026 electrician cost guide", url: "https://homeguide.com/costs/electrician-cost-per-hour" },
    { name: "EnergySage EV charger installation cost guide", url: "https://www.energysage.com/ev-charging/how-much-does-ev-charger-installation-cost/" },
  ],
};

const service = (id, title, low, high, unit, keywords, note, display = "") => ({
  id, title, low, high, unit, keywords, note, display,
});

export const ELECTRICAL_PRICE_CATEGORIES = [
  {
    id: "visit",
    title: "Visits, diagnostics & planning",
    icon: "search",
    services: [
      service("planned-estimate", "Planned-project estimate", 0, 125, "visit", "quote bid estimate planned work", "Some contractors credit this fee when hired."),
      service("service-call", "Service call / diagnostic", 125, 225, "first visit", "service call diagnose diagnostic electrician visit something wrong", "Usually covers travel and initial troubleshooting."),
      service("hourly-electrician", "Licensed electrician labor", 110, 185, "hour", "hourly labor electrician rate", "Materials and permit fees are additional."),
      service("safety-inspection", "Whole-home electrical safety inspection", 250, 550, "house", "inspection safety check buying house old house", "Includes a visual review and basic testing; destructive investigation is separate."),
      service("load-calculation", "Electrical load calculation", 250, 600, "calculation", "load calculation panel capacity enough power charger heat pump", "Often credited toward a larger service or electrification project."),
      service("emergency", "Emergency same-day dispatch", 250, 450, "dispatch", "emergency burning smell sparks no power urgent same day", "Repair labor and materials are additional."),
    ],
  },
  {
    id: "devices",
    title: "Outlets, switches & troubleshooting",
    icon: "electrical_services",
    services: [
      service("replace-outlet", "Replace a standard outlet", 125, 225, "each", "outlet plug receptacle loose broken replace", "Assumes an existing grounded box and usable wiring."),
      service("new-outlet", "Add outlet from a nearby circuit", 250, 500, "each", "new outlet add plug receptacle wall", "Short accessible wire run; wall repair is excluded."),
      service("gfci-replace", "Replace a GFCI outlet", 175, 300, "each", "gfci bathroom kitchen garage reset outlet wet", "Includes a standard GFCI device and testing."),
      service("outdoor-outlet", "Add weather-resistant outdoor outlet", 300, 650, "each", "outside outdoor exterior patio outlet plug", "Assumes a location near an existing suitable circuit."),
      service("tv-outlet", "Add TV outlet above a fireplace", 300, 700, "location", "tv television fireplace outlet hide cord", "Masonry, data cabling and wall repair can increase cost."),
      service("240-outlet", "Add a 240V receptacle", 550, 1300, "each", "220 240 volt outlet welder dryer stove nema 14-50", "Assumes available panel capacity and a moderate wire run."),
      service("replace-switch", "Replace a standard wall switch", 125, 225, "each", "switch broken light switch replace", "Assumes the existing box and wiring are usable."),
      service("dimmer", "Install a dimmer", 150, 300, "each", "dimmer dim lights switch", "Specialty dimmers and incompatible lamps may cost more."),
      service("smart-switch", "Install a smart switch", 175, 350, "each", "smart switch wifi alexa google home no neutral", "A missing neutral wire can require additional work."),
      service("dead-circuit", "Troubleshoot a dead outlet or circuit", 200, 600, "problem", "dead outlet no power outlets stopped working circuit", "Repair beyond ordinary troubleshooting is additional."),
      service("tripping-circuit", "Troubleshoot a tripping breaker", 250, 750, "problem", "breaker keeps tripping trips overloaded flicker", "Appliance faults and concealed wiring repairs are separate."),
      service("doorbell", "Repair doorbell wiring or transformer", 225, 450, "location", "doorbell transformer chime ring nest video doorbell", "Device replacement is excluded unless selected."),
    ],
  },
  {
    id: "circuits",
    title: "Circuits, breakers & protection",
    icon: "bolt",
    services: [
      service("breaker", "Replace a standard circuit breaker", 225, 425, "each", "breaker bad replace panel switch", "Assumes a listed replacement breaker is readily available."),
      service("afci-breaker", "Replace an AFCI/GFCI breaker", 275, 500, "each", "afci gfci breaker arc fault ground fault", "Troubleshooting nuisance trips may be additional."),
      service("main-breaker", "Replace a main breaker", 500, 1200, "each", "main breaker main switch no power", "Utility coordination or obsolete equipment can increase cost."),
      service("120-circuit", "Add a dedicated 120V circuit", 550, 1200, "circuit", "dedicated circuit refrigerator microwave freezer sump", "Includes a breaker and typical accessible wire run."),
      service("240-circuit", "Add a dedicated 240V circuit", 750, 1800, "circuit", "dedicated 240 circuit dryer range oven ac heat pump", "Long runs and difficult access are additional."),
      service("surge", "Install whole-house surge protection", 450, 950, "installed", "surge protector lightning whole house protection", "Assumes compatible panel space."),
      service("grounding", "Correct service grounding and bonding", 500, 1800, "project", "ground grounding bond bonding water pipe gas pipe", "Final scope depends on the service and electrode system."),
      service("trace-label", "Trace circuits and label panel", 300, 750, "panel", "label panel find circuits map breakers", "Price depends on house size and access."),
      service("load-management", "Install an electrical load-management device", 1000, 2500, "device", "load management energy management ev charger panel full", "Can avoid a service upgrade in some homes."),
    ],
  },
  {
    id: "lighting",
    title: "Lighting & fans",
    icon: "lightbulb",
    services: [
      service("fixture-replace", "Replace a standard light fixture", 175, 400, "each", "light fixture replace ceiling light", "Fixture cost and specialty assembly are excluded."),
      service("fixture-new", "Install a new light location", 350, 850, "each", "new ceiling light add light fixture wiring", "Wall and ceiling repair are excluded."),
      service("chandelier", "Install a chandelier", 350, 1200, "each", "chandelier pendant heavy light dining", "Large, fragile or high-ceiling fixtures can exceed this range."),
      service("recessed", "Install a new recessed light", 225, 425, "each", "recessed can light pot light downlight", "Best priced as a group when several share one circuit."),
      service("six-recessed", "Install six recessed lights", 1300, 2600, "set", "six 6 recessed lights cans room", "Assumes conventional access and one switching location."),
      service("cabinet-lighting", "Install under-cabinet lighting", 900, 2800, "kitchen", "under cabinet counter kitchen lights led tape", "Fixture quality and concealed driver locations affect cost."),
      service("exterior-light", "Install a new exterior wall light", 350, 750, "each", "outside exterior porch light sconce", "Masonry mounting may add cost."),
      service("floodlight", "Install motion floodlight", 350, 800, "each", "motion flood security light backyard", "Assumes a practical power source nearby."),
      service("ceiling-fan", "Replace an existing ceiling fan", 250, 500, "each", "ceiling fan replace wobble", "Fan cost is excluded."),
      service("ceiling-fan-new", "Install fan with new wiring and rated box", 650, 1300, "each", "new ceiling fan no existing wire box", "Wall repair and fan cost are excluded."),
      service("bath-fan", "Replace a bathroom exhaust fan", 350, 750, "each", "bath bathroom exhaust vent fan noisy", "New ductwork or roof termination is additional."),
      service("landscape-lighting", "Install landscape lighting system", 2000, 8000, "system", "landscape garden pathway outdoor lights", "Fixture count, transformer size and trenching drive the range."),
    ],
  },
  {
    id: "service",
    title: "Panels & electrical service",
    icon: "developer_board",
    services: [
      service("panel-swap", "Replace panel at the same amperage", 2800, 5000, "panel", "replace electrical panel breaker box same amp", "Includes a conventional panel and ordinary permit coordination."),
      service("obsolete-panel", "Replace Federal Pacific or Zinsco panel", 3200, 6000, "panel", "federal pacific fpe zinsco stab lok old unsafe panel", "Circuit corrections discovered during replacement are additional."),
      service("service-200", "Upgrade 100A service to 200A", 4000, 7500, "service", "100 amp to 200 amp service upgrade panel bigger", "Utility work beyond the property-side service may be separate."),
      service("service-400", "Upgrade to 320A/400A service", 8000, 16000, "service", "400 amp 320 amp large service upgrade", "Engineering and utility requirements can move this higher."),
      service("subpanel", "Install an indoor subpanel", 1200, 3000, "each", "subpanel sub panel more breaker spaces", "Assumes a short feeder run and adequate service capacity."),
      service("garage-subpanel", "Install a detached-garage subpanel", 2500, 7500, "project", "garage subpanel detached garage power", "Trenching distance is the largest variable."),
      service("meter-socket", "Replace a meter socket", 1200, 3000, "each", "meter box meter socket rust broken", "Requires utility coordination."),
      service("service-cable", "Replace service entrance cable", 1500, 4000, "service", "service cable outside frayed weather damaged", "Meter and mast work are separate unless specified."),
      service("service-mast", "Replace overhead service mast", 1200, 3000, "service", "mast weatherhead overhead service storm", "Roof and siding restoration are excluded."),
      service("panel-relocation", "Relocate an electrical panel", 4000, 9000, "project", "move relocate breaker panel box", "Circuit extensions and finish restoration drive cost."),
    ],
  },
  {
    id: "equipment",
    title: "Appliances, heating & pumps",
    icon: "home_repair_service",
    services: [
      service("range", "Electric range circuit and connection", 850, 1800, "appliance", "electric stove range oven circuit", "Appliance is excluded."),
      service("dryer", "Electric dryer circuit and receptacle", 750, 1600, "appliance", "electric dryer outlet plug circuit", "Assumes a typical panel-to-laundry run."),
      service("induction", "Induction range circuit", 900, 2000, "appliance", "induction cooktop stove circuit", "A service load calculation may be needed."),
      service("water-heater", "Electric water-heater circuit", 750, 1600, "appliance", "electric water heater circuit", "Plumbing work is excluded."),
      service("mini-split", "Mini-split circuit and disconnect", 850, 1800, "unit", "mini split heat pump disconnect circuit", "HVAC equipment and startup are excluded."),
      service("baseboard", "Electric baseboard heater circuit", 600, 1400, "each", "electric baseboard heat heater", "Thermostat and heater selection affect price."),
      service("sump", "Dedicated sump-pump circuit", 500, 1100, "circuit", "sump pump basement backup dedicated outlet", "Pump and plumbing work are excluded."),
      service("well", "Well or sewage-pump circuit", 750, 1800, "circuit", "well pump septic sewage ejector circuit", "Controls and trenching are additional."),
      service("hot-tub", "Hot-tub circuit and disconnect", 1500, 4000, "unit", "hot tub spa jacuzzi wiring disconnect", "Tub, pad and trench restoration are excluded."),
      service("pool", "Pool equipment panel and bonding", 2500, 7500, "project", "pool pump bonding panel lights", "Pool geometry and inspection requirements affect scope."),
      service("bidet", "Add receptacle for bidet or smart toilet", 350, 800, "each", "bidet smart toilet outlet bathroom", "Requires GFCI protection."),
      service("gate", "Automatic driveway-gate power", 1500, 6000, "project", "electric driveway gate opener power", "Gate equipment and long trenching are excluded."),
    ],
  },
  {
    id: "ev-backup",
    title: "EV charging & backup power",
    icon: "ev_station",
    services: [
      service("ev-assessment", "EV charger load assessment", 250, 500, "assessment", "ev electric car tesla charger load panel check", "Often credited when the installation proceeds."),
      service("ev-near", "Level 2 EV charger near panel", 900, 1500, "installation", "ev electric car tesla charger garage near panel", "Installation only; charger equipment is excluded."),
      service("ev-typical", "Level 2 EV charger, 25–50 ft run", 1500, 3200, "installation", "ev electric car tesla chargepoint charger garage long run", "Installation only; finished walls and routing affect cost."),
      service("ev-outdoor", "Outdoor or detached EV charger", 2500, 6000, "installation", "outside outdoor detached garage ev charger driveway", "Installation only; trenching and restoration vary."),
      service("generator-inlet", "Generator inlet and interlock", 900, 1800, "installed", "portable generator inlet interlock outage", "Generator and extension cable are excluded."),
      service("transfer-switch", "Manual transfer switch", 1200, 2500, "installed", "generator transfer switch manual", "Generator is excluded."),
      service("standby-generator", "Whole-house standby generator", 9000, 20000, "system", "whole house standby generator generac", "Includes typical equipment and electrical installation; gas work varies."),
      service("battery", "Home-battery electrical integration", 4000, 10000, "electrical scope", "home battery backup powerwall storage", "Battery equipment is excluded."),
    ],
  },
  {
    id: "rewiring",
    title: "Renovations, rewiring & older homes",
    icon: "history",
    services: [
      service("bedroom-rewire", "Rewire one bedroom", 2500, 6000, "room", "rewire bedroom old wiring", "Finish repair is excluded."),
      service("kitchen-package", "Kitchen remodel electrical package", 5000, 15000, "project", "kitchen remodel electrical outlets appliances lights", "Final price depends on appliance schedule and wall access."),
      service("bath-package", "Bathroom electrical upgrade", 1500, 4500, "project", "bathroom remodel fan light gfci electrical", "Heated floors and specialty equipment are separate."),
      service("basement-package", "Finished-basement electrical package", 4000, 12000, "project", "finish basement electrical outlets lights", "Assumes framing is accessible before drywall."),
      service("house-rewire", "Whole-house conventional rewire", 8, 18, "sq ft", "rewire whole house replace old wiring", "Plaster and paint repair are excluded."),
      service("knob-tube", "Knob-and-tube replacement", 10, 22, "sq ft", "knob tube old cloth wiring replace", "Occupied plaster homes commonly fall near the high end."),
      service("aluminum-device", "Aluminum-wiring remediation", 100, 250, "device", "aluminum wiring copalum alumicon remediation", "Method must be selected by a qualified electrician."),
      service("aluminum-house", "Whole-house aluminum remediation", 4000, 15000, "house", "whole house aluminum wiring remediation", "Device count and accessible junctions determine scope."),
      service("code-corrections", "Electrical violation correction package", 1000, 10000, "project", "code violations inspection corrections insurance", "Requires an itemized inspection report or site evaluation."),
      service("temporary-power", "Temporary construction power", 1500, 5000, "service", "temporary construction power remodel", "Utility and site conditions affect the final price."),
    ],
  },
  {
    id: "smart-low-voltage",
    title: "Safety, smart home & low voltage",
    icon: "sensors",
    services: [
      service("smoke", "Replace a hardwired smoke detector", 175, 300, "each", "smoke detector alarm chirping hardwired", "Detector is included at the standard level."),
      service("smoke-house", "Whole-house smoke/CO update", 1200, 3500, "house", "whole house smoke carbon monoxide co detectors", "Quantity and interconnection method drive cost."),
      service("ethernet", "Ethernet/data cable drop", 200, 450, "drop", "ethernet internet network cat6 data cable", "Patching and network equipment are excluded."),
      service("camera", "Security camera wiring", 250, 600, "camera", "security camera wire poe outdoor", "Camera equipment is excluded."),
      service("smart-thermostat", "Install smart thermostat", 250, 500, "each", "nest ecobee smart thermostat c wire", "New control cable may add $350–$750."),
      service("energy-monitor", "Install an energy monitor", 400, 1200, "device", "energy monitor sense emporia usage", "Assumes compatibility with the existing panel."),
      service("smart-panel", "Install a smart electrical panel", 5000, 12000, "panel", "smart panel span energy circuits", "Service modifications and equipment options affect price."),
      service("structured-wiring", "Structured wiring panel", 1000, 3500, "panel", "structured wiring media panel network coax", "Device termination and network hardware vary."),
    ],
  },
  {
    id: "conditions",
    title: "Access, permits & project add-ons",
    icon: "fact_check",
    services: [
      service("permit-handling", "Permit handling and administration", 100, 300, "permit", "permit application administration paperwork", "The municipality's actual permit and inspection charges are additional."),
      service("media-permit", "Media Borough residential electrical permit", 204.5, 204.5, "permit", "media borough electrical permit fee", "Published total for residential work up to 200A and residential additions or renovations.", "$204.50"),
      service("lower-merion-permit", "Lower Merion residential electrical permit", 112.5, 250, "permit", "lower merion electrical permit fee plan review", "Published schedule starts at $42.50 for the first $2,000 of work, adds $8 per additional $1,000, and lists a $70 residential plan review.", "$42.50 base + valuation fee + $70 review"),
      service("wall-fishing", "Finished-wall or ceiling wire fishing", 150, 500, "run", "fish wire finished wall ceiling access", "Added when wiring must be routed without open framing."),
      service("masonry", "Brick, stone or concrete penetration", 200, 750, "opening", "brick stone concrete masonry drill penetration", "Core drilling, fire stopping and finish matching can increase cost."),
      service("crawlspace", "Difficult crawlspace access", 250, 750, "project", "crawlspace crawl space tight access", "Added for limited, wet or obstructed access."),
      service("attic", "Difficult attic access", 250, 750, "project", "attic tight insulation difficult access", "Heat, insulation depth and restricted movement affect the charge."),
      service("high-ceiling", "High-ceiling fixture access", 200, 800, "fixture", "high ceiling ladder chandelier foyer", "Scaffolding or powered lifts are separate when required."),
      service("lift", "Scaffold or lift rental", 500, 2000, "project", "scaffold scaffolding lift rental high ceiling", "Delivery and rental duration affect cost."),
      service("occupied-protection", "Occupied-work-area protection", 150, 500, "day", "occupied home protect furniture dust floor", "Covers setup, surface protection and daily cleanup."),
      service("drywall-repair", "Drywall or plaster repair allowance", 300, 2500, "project", "drywall plaster patch repair after electrical", "Painting and exact finish matching are commonly separate."),
      service("after-hours", "After-hours scheduling premium", 50, 100, "labor premium", "after hours evening weekend holiday emergency premium", "Applied to ordinary labor rates when work is requested outside normal hours.", "+50%–100% labor"),
    ],
  },
];

export const ELECTRICAL_SERVICES = ELECTRICAL_PRICE_CATEGORIES.flatMap(category =>
  category.services.map(item => ({ ...item, categoryId: category.id, categoryTitle: category.title })),
);

const STOP_WORDS = new Set("a an and are can could do does for from have how i in is it me my of on or our please should the this to want what with would you".split(" "));

export function formatPriceRange(low, high, unit = "") {
  const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return `${money(low)}–${money(high)}${unit ? ` / ${unit}` : ""}`;
}

export function findElectricalServices(question, limit = 4) {
  const normalized = String(question || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const words = normalized.split(" ").filter(word => word.length > 1 && !STOP_WORDS.has(word));
  return ELECTRICAL_SERVICES.map(item => {
    const haystack = `${item.title} ${item.keywords} ${item.note}`.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (haystack.includes(word)) score += word.length >= 6 ? 3 : 1;
    }
    for (const phrase of item.keywords.split(" ")) {
      if (phrase.length >= 4 && normalized.includes(phrase)) score += 1;
    }
    if (/\b(ev|electric car|car charger|tesla|chargepoint)\b/.test(normalized) && item.id.startsWith("ev-")) score += 12;
    if (/\b(no power|dead|stopped working)\b/.test(normalized) && item.id === "dead-circuit") score += 8;
    if (/\b(trip|tripping|keeps tripping)\b/.test(normalized) && item.id === "tripping-circuit") score += 8;
    if (/\b(100|200)\s*(amp|a)\b/.test(normalized) && item.id === "service-200") score += 8;
    return { ...item, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.low - b.low).slice(0, limit);
}

const ROUTE_RATES = {
  open: { low: 10, high: 18 },
  finished: { low: 18, high: 32 },
  exterior: { low: 22, high: 40 },
  trench: { low: 40, high: 75 },
};

const PANEL_ADDERS = {
  ready: { low: 0, high: 0, label: "Panel has capacity and breaker space" },
  space: { low: 600, high: 1700, label: "Panel needs space or a small subpanel" },
  managed: { low: 1000, high: 2500, label: "Load-management equipment" },
  upgrade: { low: 4000, high: 7500, label: "100A-to-200A service upgrade" },
  unknown: { low: 0, high: 0, label: "Panel capacity needs an electrician's load calculation" },
};

export function estimateEvCharger(input) {
  const distance = Math.max(0, Math.min(300, Number(input.distance) || 0));
  const route = ROUTE_RATES[input.route] || ROUTE_RATES.open;
  const panel = PANEL_ADDERS[input.panel] || PANEL_ADDERS.unknown;
  const extraFeet = Math.max(0, distance - 10);
  let low = 900 + extraFeet * route.low + panel.low;
  let high = 1400 + extraFeet * route.high + panel.high;
  const breakdown = [
    { label: "Breaker, first 10 ft of wiring, mounting and labor", low: 900, high: 1400 },
    ...(extraFeet ? [{ label: `${extraFeet} additional ft via ${input.route || "open"} route`, low: extraFeet * route.low, high: extraFeet * route.high }] : []),
    ...(panel.high ? [{ label: panel.label, low: panel.low, high: panel.high }] : []),
  ];
  if (input.connection === "receptacle") {
    low += 150; high += 350;
    breakdown.push({ label: "Industrial 14-50 receptacle and GFCI-related allowance", low: 150, high: 350 });
  }
  if (input.detached) {
    low += 500; high += 2000;
    breakdown.push({ label: "Detached-garage routing allowance", low: 500, high: 2000 });
  }
  if (input.includeCharger) {
    low += 400; high += 1200;
    breakdown.push({ label: "Level 2 charging equipment allowance", low: 400, high: 1200 });
  }
  return { low: Math.round(low), high: Math.round(high), breakdown, needsLoadCheck: input.panel === "unknown" };
}
