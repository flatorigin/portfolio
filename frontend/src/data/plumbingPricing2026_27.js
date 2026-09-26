export const PLUMBING_PRICEBOOK_META = {
  version: "2026–27 · provisional", region: "Media and Philadelphia Main Line, Pennsylvania",
  basis: "Editable planning allowances, not verified local quotes. 2027 is a projection pending review.",
  sources: [
    { name: "HomeGuide plumbing cost reference", url: "https://homeguide.com/costs/plumber-cost" },
    { name: "HomeGuide fixture replacement reference", url: "https://homeguide.com/costs/faucet-installation-cost" },
    { name: "HomeGuide water heater reference", url: "https://homeguide.com/costs/water-heater-installation-cost" },
  ],
};
// Editorial planning allowances, seeded from broad consumer references, not local contractor quotes.
// Installation entries exclude homeowner-supplied equipment unless equipment is explicitly included.
const rows = [
  ["visit", "Visits & diagnosis", [
    ["inspection", "Residential plumbing inspection", 200, 500, "inspection", "diagnosis", "buy house inspection"],
    ["leak-diagnosis", "Locate a concealed water leak", 200, 650, "investigation", "diagnosis", "leaking wall ceiling wet hidden"],
    ["pressure-test", "Water pressure diagnosis", 150, 350, "investigation", "diagnosis", "low pressure weak shower"],
    ["camera", "Drain camera inspection", 250, 650, "inspection", "diagnosis", "sewer camera recurring clog roots"],
    ["odor", "Sewer odor investigation", 175, 450, "investigation", "diagnosis", "smell sewer gas stink"],
    ["emergency", "Emergency dispatch and assessment", 250, 500, "visit", "diagnosis", "urgent burst flooding emergency"],
  ]],
  ["fixtures", "Sinks & faucets", [
    ["kitchen-faucet", "Replace kitchen faucet", 200, 450, "each", "replace", "kitchen dripping tap faucet"],
    ["bath-faucet", "Replace bathroom faucet", 175, 400, "each", "replace", "bathroom tap faucet"],
    ["faucet-repair", "Repair faucet cartridge or seals", 150, 350, "each", "repair", "dripping leaking faucet cartridge"],
    ["kitchen-sink", "Replace kitchen sink connections", 350, 800, "each", "replace", "kitchen sink drain reconnect"],
    ["vanity", "Connect bathroom vanity sink", 300, 750, "each", "replace", "bathroom vanity sink"],
    ["double-vanity", "Convert to double vanity plumbing", 900, 2200, "project", "site", "two bathroom sinks"],
    ["p-trap", "Replace sink P-trap", 125, 300, "each", "repair", "trap sink leaking drain"],
    ["strainer", "Replace sink strainer or stopper", 125, 300, "each", "repair", "basket drain stopper plug"],
    ["supply-hose", "Replace fixture supply hoses", 100, 225, "pair", "repair", "flexible hose supply leaking"],
    ["fixture-valve", "Replace fixture shutoff valve", 150, 325, "each", "repair", "angle stop valve sink toilet"],
  ]],
  ["toilets", "Toilets & bidets", [
    ["toilet-replace", "Replace floor-mounted toilet", 250, 600, "each", "replace", "toilet replacement bathroom"],
    ["running-toilet", "Repair running toilet", 125, 300, "each", "repair", "running toilet flapper fill valve flush"],
    ["toilet-reset", "Reset toilet with new seal", 200, 425, "each", "repair", "wax ring base leaking rocking"],
    ["flange", "Repair accessible toilet flange", 250, 600, "each", "repair", "broken flange toilet"],
    ["bidet", "Connect bidet seat water supply", 150, 350, "each", "replace", "bidet smart toilet seat"],
    ["new-toilet", "New toilet drain and supply location", 1500, 4000, "location", "site", "add relocate toilet"],
    ["wall-toilet", "Service concealed wall-hung toilet", 300, 900, "investigation", "diagnosis", "wall hung concealed cistern"],
  ]],
  ["bathing", "Showers & tubs", [
    ["showerhead", "Replace showerhead and arm", 100, 250, "each", "replace", "shower head"],
    ["tub-spout", "Replace tub spout", 125, 300, "each", "replace", "tub diverter spout"],
    ["shower-cartridge", "Replace shower cartridge", 200, 450, "each", "repair", "shower dripping temperature"],
    ["shower-valve", "Replace accessible shower mixing valve", 500, 1100, "each", "replace", "shower mixer valve"],
    ["tub-drain", "Replace accessible tub drain and overflow", 300, 700, "each", "repair", "bathtub waste overflow"],
    ["tub-hookup", "Connect bathtub plumbing", 650, 1500, "each", "replace", "freestanding bathtub hookup"],
    ["shower-relocate", "Relocate shower drain and supplies", 1500, 4500, "project", "site", "shower conversion remodel"],
  ]],
  ["appliances", "Appliances & laundry", [
    ["disposal", "Replace garbage disposal", 225, 500, "each", "replace", "kitchen garbage disposal"],
    ["disposal-diagnosis", "Diagnose jammed or leaking disposal", 125, 250, "investigation", "diagnosis", "disposal jam hum"],
    ["dishwasher", "Connect dishwasher water and drain", 200, 450, "each", "replace", "kitchen dishwasher hookup"],
    ["fridge-line", "Install refrigerator water line", 200, 500, "line", "replace", "kitchen ice maker fridge"],
    ["washer-box", "Replace washer outlet box and valves", 350, 800, "each", "replace", "laundry washing machine valves"],
    ["washer-hoses", "Replace washing-machine hoses", 100, 200, "pair", "repair", "laundry washer hoses"],
    ["utility-sink", "Connect utility sink", 350, 800, "each", "replace", "basement laundry slop sink"],
    ["standpipe", "Install laundry trap and standpipe", 400, 900, "each", "replace", "washer drain standpipe"],
    ["laundry-relocate", "Relocate laundry water and drain", 1200, 3500, "project", "site", "move laundry washer"],
  ]],
  ["heaters", "Water heaters", [
    ["tank-heater", "Replace tank water heater — equipment included", 1400, 3200, "each", "equipment", "hot water tank gas electric"],
    ["tankless", "Replace tankless heater — equipment included", 2500, 5500, "each", "equipment", "tankless hot water"],
    ["heater-conversion", "Convert tank to tankless water heater", 3500, 7500, "project", "site", "tankless conversion"],
    ["heater-diagnosis", "Diagnose water heater fault", 175, 400, "investigation", "diagnosis", "no hot water cold heater"],
    ["heater-flush", "Flush tank water heater", 150, 300, "each", "repair", "sediment flush water heater"],
    ["tankless-descale", "Descale tankless water heater", 200, 400, "each", "repair", "tankless service descale"],
    ["anode", "Replace accessible anode rod", 200, 400, "each", "repair", "anode corrosion"],
    ["expansion-tank", "Replace expansion tank", 250, 500, "each", "repair", "expansion tank pressure"],
    ["heater-valve", "Replace heater relief valve", 200, 400, "each", "repair", "relief valve dripping"],
    ["recirculation", "Install hot-water recirculation pump", 500, 1400, "each", "equipment", "wait hot water pump"],
  ]],
  ["drains", "Drains & sewers", [
    ["sink-clog", "Clear accessible sink drain", 150, 350, "drain", "clearing", "kitchen sink clogged slow"],
    ["toilet-clog", "Clear toilet blockage", 150, 300, "drain", "clearing", "toilet clogged blocked"],
    ["tub-clog", "Clear tub or shower drain", 150, 350, "drain", "clearing", "bathroom shower tub slow clog hair"],
    ["main-clog", "Clear main drain through cleanout", 250, 650, "run", "clearing", "basement backup multiple drains sewage"],
    ["jetting", "Hydro jet suitable drain piping", 450, 1000, "run", "site", "jet roots grease"],
    ["drain-repair", "Repair accessible drain pipe", 250, 700, "repair", "repair", "drain pipe leaking pvc cast iron"],
    ["cleanout", "Install accessible drain cleanout", 400, 1000, "each", "replace", "cleanout access"],
    ["vent", "Repair accessible plumbing vent", 300, 850, "repair", "repair", "vent gurgling"],
    ["sewer-replace", "Replace underground sewer line", 100, 250, "linear ft", "site", "sewer excavate underground"],
    ["sewer-lining", "Trenchless sewer lining assessment", 300, 700, "assessment", "diagnosis", "lining trenchless sewer"],
  ]],
  ["supply", "Water pipes & valves", [
    ["pipe-leak", "Repair accessible water pipe leak", 200, 550, "repair", "repair", "burst leaking copper pex pipe"],
    ["branch-pipe", "Replace accessible supply branch", 25, 65, "linear ft", "site", "copper pex galvanized pipe"],
    ["repipe", "Whole-house repiping allowance", 5000, 15000, "project", "site", "repipe house old pipes"],
    ["main-valve", "Replace accessible main shutoff", 300, 700, "each", "repair", "main stop valve"],
    ["pressure-regulator", "Replace pressure regulator", 350, 800, "each", "repair", "pressure reducing valve prv"],
    ["hammer", "Install water-hammer arrestor", 150, 350, "each", "repair", "banging pipes water hammer"],
    ["smart-shutoff", "Install automatic leak shutoff", 700, 1600, "each", "equipment", "smart leak sensor shutoff"],
    ["water-service", "Replace underground water service", 100, 250, "linear ft", "site", "water main service yard"],
  ]],
  ["pumps", "Pumps & wells", [
    ["sump-replace", "Replace sump pump — equipment included", 500, 1200, "each", "equipment", "basement sump pump"],
    ["sump-backup", "Add battery sump backup — equipment included", 800, 1800, "each", "equipment", "battery backup sump"],
    ["sump-pit", "New sump pit and discharge installation", 1800, 4000, "project", "site", "basement flood pit"],
    ["ejector", "Replace sewage ejector — equipment included", 900, 2200, "each", "equipment", "basement sewage ejector pump"],
    ["check-valve", "Replace pump check valve", 150, 350, "each", "repair", "sump check valve"],
    ["well-diagnosis", "Well pressure and pump diagnosis", 200, 550, "investigation", "diagnosis", "well no water pump pressure"],
    ["well-tank", "Replace well pressure tank", 900, 2200, "each", "equipment", "well pressure tank"],
  ]],
  ["outdoor", "Outdoor & water treatment", [
    ["hose-bib", "Replace accessible hose bib", 200, 450, "each", "replace", "outdoor garden faucet hose"],
    ["frost-free", "Install frost-free outdoor faucet", 300, 650, "each", "replace", "frost free outdoor spigot"],
    ["winterize", "Winterize seasonal plumbing", 200, 500, "project", "repair", "winterize outdoor freeze"],
    ["filter", "Install under-sink filter", 250, 600, "each", "replace", "filter drinking water kitchen"],
    ["whole-filter", "Install whole-house filter — equipment included", 800, 2000, "each", "equipment", "whole house filtration"],
    ["softener", "Install water softener — equipment included", 1200, 3000, "each", "equipment", "hard water softener"],
    ["reverse-osmosis", "Install reverse-osmosis system", 500, 1200, "each", "equipment", "ro drinking water"],
  ]],
  ["remodel", "Room remodel packages", [
    ["kitchen-package", "Kitchen plumbing remodel package", 2000, 6000, "project", "site", "kitchen renovation package"],
    ["bath-package", "Bathroom plumbing remodel package", 3000, 9000, "project", "site", "bathroom remodel package"],
    ["basement-package", "Basement bathroom plumbing package", 4500, 12000, "project", "site", "basement bathroom addition"],
    ["powder-room", "New powder-room plumbing", 3000, 8000, "project", "site", "half bath powder room"],
  ]],
];
export const PLUMBING_PRICE_CATEGORIES = rows.map(([id, title, entries]) => ({ id, title, services: entries.map(([id, title, low, high, unit, mode, keywords]) => ({ id, title, low, high, unit, mode, keywords, note: mode === "diagnosis" ? "Investigation and findings; repair work is separate." : mode === "site" ? "Scope, measurements and access must be confirmed before a firm quote." : mode === "equipment" ? "Standard equipment allowance included; existing compatible connections assumed." : mode === "clearing" ? "One accessible drain; pipe replacement and camera inspection are separate." : "Accessible existing connections. New fixtures/appliances supplied by homeowner; ordinary repair parts included.", priceStatus: "provisional", reviewedAt: "2026-09-25" })) }));
export const PLUMBING_SERVICES = PLUMBING_PRICE_CATEGORIES.flatMap(category => category.services.map(item => ({ ...item, categoryId: category.id, categoryTitle: category.title })));
export function formatPriceRange(low, high, unit = "") { return `$${low.toLocaleString()}–$${high.toLocaleString()}${unit ? ` / ${unit}` : ""}`; }
export function findPlumbingServices(query, limit = 6) {
  const words = query.toLowerCase().split(/\W+/).filter(word => word.length > 2 && !["the", "and", "need", "have", "with", "want"].includes(word));
  return PLUMBING_SERVICES.map(item => ({ ...item, score: words.reduce((score, word) => score + (`${item.title} ${item.keywords}`.toLowerCase().includes(word) ? 1 : 0), 0) })).filter(item => item.score).sort((a, b) => b.score - a.score).slice(0, limit);
}
