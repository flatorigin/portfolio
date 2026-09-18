export const FRAMING_CALCULATION_VERSION = "framing-v1";

let clientId = 0;
const nextId = (prefix) => `${prefix}-${Date.now()}-${++clientId}`;
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const money = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
const moneyString = (value) => money(value).toFixed(2);
const numberString = (value) => String(money(value));

export function createOpening(overrides = {}) {
  return {
    id: nextId("opening"), name: "Window 1", type: "window", position_ft: "4", width_ft: "3", height_ft: "4",
    sill_height_ft: "3", king_studs_per_side: "1", jack_studs_per_side: "1", header_description: "",
    header_ply_count: "2", header_unit_price_per_lf: "0", ...overrides,
  };
}

export function createWallSection(overrides = {}) {
  return {
    id: nextId("wall"), name: "Main level walls", level: "Main Level", length_ft: "40", height_ft: "8",
    wall_type: "interior", bearing: "non_bearing", stud_size: "2x4", stud_spacing_in: "16",
    bottom_plate_layers: "1", top_plate_layers: "2", blocking_rows: "0", corner_count: "2", corner_extra_studs: "2",
    intersection_count: "0", intersection_extra_studs: "2", stud_unit_price: "4.50", plate_unit_price_per_lf: "1.25",
    blocking_unit_price_per_lf: "1.25", stud_waste_percent: "10", plate_waste_percent: "10",
    sheathing_enabled: false, sheathing_type: "7/16 in OSB", panel_width_ft: "4", panel_height_ft: "8",
    sheathing_unit_price: "18", sheathing_waste_percent: "10", labor_productivity_lf_per_hour: "8",
    loaded_hourly_rate: "75", complexity_factor: "1", openings: [], notes: "", ...overrides,
    openings: Array.isArray(overrides.openings) ? overrides.openings.map((item) => createOpening(item)) : [],
  };
}

export function createFloorSection(overrides = {}) {
  return {
    id: nextId("floor"), name: "Floor framing", length_ft: "20", width_ft: "16", joist_direction: "width",
    joist_spacing_in: "16", joist_size: "2x10", joist_unit_price_per_lf: "2.25", rim_board_lf: "0",
    rim_unit_price_per_lf: "2.50", blocking_rows: "1", blocking_unit_price_per_lf: "1.50",
    subfloor_enabled: true, subfloor_unit_price: "32", subfloor_waste_percent: "10",
    labor_productivity_sqft_per_hour: "24", loaded_hourly_rate: "75", complexity_factor: "1", ...overrides,
  };
}

export function createStructuralMember(overrides = {}) {
  return {
    id: nextId("member"), name: "Beam or post", member_type: "beam", description: "", length_ft: "10",
    quantity: "1", ply_count: "1", unit_price_per_lf: "0", labor_price_each: "0", resolution: "tbd", ...overrides,
  };
}

export function createRoofSection(overrides = {}) {
  return {
    id: nextId("roof"), name: "Main roof", method: "truss", building_length_ft: "30", span_ft: "24",
    spacing_in: "24", pitch_rise: "6", overhang_ft: "1", truss_unit_price: "180",
    truss_labor_price_each: "70", special_truss_count: "0", special_truss_unit_price: "0",
    rafter_unit_price_per_lf: "2.25", rafter_labor_price_each: "45", ridge_unit_price_per_lf: "3",
    sheathing_enabled: true, sheathing_unit_price: "32", sheathing_waste_percent: "10", ...overrides,
  };
}

export function createDefaultFramingInputs() {
  return {
    prepared_by: "", client_name: "", project_location: "", wall_sections: [createWallSection()], floor_sections: [],
    structural_members: [], roof_sections: [], hardware_items: [], cost_allowances: [], included_scope: [],
    excluded_scope: [], assumptions: [], extras: [], overhead_percent: "10", profit_method: "markup",
    profit_percent: "20", tax_percent: "0", discount_type: "percent", discount_value: "0", notes: "",
    output_preference: "detailed",
  };
}

export function normalizeFramingInputsForEditor(raw = {}) {
  const defaults = createDefaultFramingInputs();
  return {
    ...defaults, ...raw,
    wall_sections: Array.isArray(raw.wall_sections) ? raw.wall_sections.map((item) => createWallSection(item)) : defaults.wall_sections,
    floor_sections: Array.isArray(raw.floor_sections) ? raw.floor_sections.map((item) => createFloorSection(item)) : [],
    structural_members: Array.isArray(raw.structural_members) ? raw.structural_members.map((item) => createStructuralMember(item)) : [],
    roof_sections: Array.isArray(raw.roof_sections) ? raw.roof_sections.map((item) => createRoofSection(item)) : [],
    hardware_items: Array.isArray(raw.hardware_items) ? raw.hardware_items : [],
    cost_allowances: Array.isArray(raw.cost_allowances) ? raw.cost_allowances : [],
    included_scope: Array.isArray(raw.included_scope) ? raw.included_scope : [],
    excluded_scope: Array.isArray(raw.excluded_scope) ? raw.excluded_scope : [],
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions : [],
    extras: Array.isArray(raw.extras) ? raw.extras : [],
  };
}

function line(code, name, description, quantity, unit, rate, amount, trace) {
  return { code, name, description, quantity: numberString(quantity), unit, rate: moneyString(rate), amount: moneyString(amount), trace };
}

function calculateWall(wall, index) {
  const length = Math.max(0, number(wall.length_ft));
  const height = Math.max(0, number(wall.height_ft));
  const spacing = Math.max(1, number(wall.stud_spacing_in, 16));
  const basePositions = Math.ceil(length * 12 / spacing) + 1;
  const interrupted = new Set();
  let openingArea = 0;
  let openingAdditions = 0;
  let headerLf = 0;
  let headerCost = 0;
  (wall.openings || []).forEach((opening) => {
    const start = number(opening.position_ft) * 12;
    const end = start + number(opening.width_ft) * 12;
    let interruptedCount = 0;
    for (let positionIndex = 0; positionIndex < basePositions; positionIndex += 1) {
      const position = positionIndex * spacing;
      if (start < position && position < end) {
        interrupted.add(positionIndex);
        interruptedCount += 1;
      }
    }
    interruptedCount = Math.max(1, interruptedCount);
    openingAdditions += number(opening.king_studs_per_side, 1) * 2 + number(opening.jack_studs_per_side, 1) * 2 + interruptedCount;
    if (opening.type === "window") openingAdditions += interruptedCount;
    openingArea += number(opening.width_ft) * number(opening.height_ft);
    const openingHeaderLf = (number(opening.width_ft) + number(opening.jack_studs_per_side) * 0.25) * number(opening.header_ply_count, 1);
    headerLf += openingHeaderLf;
    headerCost += openingHeaderLf * number(opening.header_unit_price_per_lf);
  });
  const connections = number(wall.corner_count) * number(wall.corner_extra_studs) + number(wall.intersection_count) * number(wall.intersection_extra_studs);
  const rawStuds = Math.max(0, basePositions - interrupted.size + openingAdditions + connections);
  const orderedStuds = Math.ceil(rawStuds * (1 + number(wall.stud_waste_percent) / 100));
  const plateRaw = length * (number(wall.bottom_plate_layers) + number(wall.top_plate_layers));
  const plateOrder = Math.ceil(plateRaw * (1 + number(wall.plate_waste_percent) / 100));
  const blockingLf = length * number(wall.blocking_rows);
  const items = [
    line(`wall_${index + 1}_studs`, "Wall studs", `${wall.stud_size} studs including openings, corners, and intersections`, orderedStuds, "stud", number(wall.stud_unit_price), orderedStuds * number(wall.stud_unit_price), `ceil((${basePositions} base - ${interrupted.size} interrupted + ${openingAdditions} opening + ${connections} connection studs) x waste)`),
    line(`wall_${index + 1}_plates`, "Top and bottom plates", "Plate stock; door openings are not deducted", plateOrder, "linear ft", number(wall.plate_unit_price_per_lf), plateOrder * number(wall.plate_unit_price_per_lf), `${length} ft x plate layers, then waste`),
  ];
  if (blockingLf > 0) items.push(line(`wall_${index + 1}_blocking`, "Wall blocking", `${wall.blocking_rows} continuous blocking row(s)`, blockingLf, "linear ft", number(wall.blocking_unit_price_per_lf), blockingLf * number(wall.blocking_unit_price_per_lf), "wall length x blocking rows"));
  if (headerLf > 0) items.push(line(`wall_${index + 1}_headers`, "Opening headers", "Specified header stock for doors and windows", headerLf, "linear ft", headerLf ? headerCost / headerLf : 0, headerCost, "opening width plus jack bearing x header ply count"));
  if (wall.sheathing_enabled) {
    const netArea = Math.max(0, length * height - openingArea);
    const panelArea = Math.max(0.1, number(wall.panel_width_ft, 4) * number(wall.panel_height_ft, 8));
    const sheets = Math.ceil(netArea * (1 + number(wall.sheathing_waste_percent) / 100) / panelArea);
    items.push(line(`wall_${index + 1}_sheathing`, "Wall sheathing", wall.sheathing_type, sheets, "sheet", number(wall.sheathing_unit_price), sheets * number(wall.sheathing_unit_price), `ceil((${money(length * height)} gross sq ft - ${money(openingArea)} openings) x waste / ${panelArea} sq ft)`));
  }
  const hours = length / Math.max(0.01, number(wall.labor_productivity_lf_per_hour, 8)) * Math.max(0.1, number(wall.complexity_factor, 1));
  items.push(line(`wall_${index + 1}_labor`, "Wall framing labor", `Loaded labor at ${wall.complexity_factor}x complexity`, hours, "hour", number(wall.loaded_hourly_rate), hours * number(wall.loaded_hourly_rate), "wall length / productivity x complexity"));
  return { section_id: wall.id, name: wall.name, category: "Wall framing", line_items: items, subtotal: moneyString(items.reduce((sum, item) => sum + number(item.amount), 0)), metrics: { base_stud_positions: basePositions, interrupted_studs: interrupted.size, ordered_studs: orderedStuds, net_sheathing_area: numberString(Math.max(0, length * height - openingArea)) } };
}

function calculateFloor(floor, index) {
  const length = number(floor.length_ft); const width = number(floor.width_ft);
  const distributed = floor.joist_direction === "width" ? length : width;
  const memberLength = floor.joist_direction === "width" ? width : length;
  const count = Math.ceil(distributed * 12 / Math.max(1, number(floor.joist_spacing_in, 16))) + 1;
  const joistLf = count * memberLength;
  const rimLf = number(floor.rim_board_lf) || (length + width) * 2;
  const blockCount = Math.max(0, count - 1) * number(floor.blocking_rows);
  const blockLf = blockCount * number(floor.joist_spacing_in) / 12;
  const area = length * width;
  const items = [
    line(`floor_${index + 1}_joists`, "Floor joists", floor.joist_size, joistLf, "linear ft", number(floor.joist_unit_price_per_lf), joistLf * number(floor.joist_unit_price_per_lf), `${count} joists x ${memberLength} ft`),
    line(`floor_${index + 1}_rim`, "Rim board", "Perimeter rim board", rimLf, "linear ft", number(floor.rim_unit_price_per_lf), rimLf * number(floor.rim_unit_price_per_lf), "entered rim length or full perimeter"),
  ];
  if (blockLf > 0) items.push(line(`floor_${index + 1}_blocking`, "Joist blocking", `${floor.blocking_rows} row(s)`, blockLf, "linear ft", number(floor.blocking_unit_price_per_lf), blockLf * number(floor.blocking_unit_price_per_lf), "(joist count - 1) x rows x spacing"));
  if (floor.subfloor_enabled) {
    const sheets = Math.ceil(area * (1 + number(floor.subfloor_waste_percent) / 100) / 32);
    items.push(line(`floor_${index + 1}_subfloor`, "Subfloor panels", "4 x 8 panels", sheets, "sheet", number(floor.subfloor_unit_price), sheets * number(floor.subfloor_unit_price), "ceil(floor area x waste / 32 sq ft)"));
  }
  const hours = area / Math.max(0.01, number(floor.labor_productivity_sqft_per_hour, 24)) * Math.max(0.1, number(floor.complexity_factor, 1));
  items.push(line(`floor_${index + 1}_labor`, "Floor framing labor", `Loaded labor at ${floor.complexity_factor}x complexity`, hours, "hour", number(floor.loaded_hourly_rate), hours * number(floor.loaded_hourly_rate), "floor area / productivity x complexity"));
  return { section_id: floor.id, name: floor.name, category: "Floor framing", line_items: items, subtotal: moneyString(items.reduce((sum, item) => sum + number(item.amount), 0)), metrics: { joist_count: count, floor_area: numberString(area), blocking_count: blockCount } };
}

function calculateMember(member, index) {
  const quantity = number(member.quantity); const totalLf = quantity * number(member.length_ft) * number(member.ply_count);
  const material = totalLf * number(member.unit_price_per_lf); const labor = quantity * number(member.labor_price_each);
  const items = [line(`member_${index + 1}_material`, member.name, member.description || member.member_type, totalLf, "linear ft", number(member.unit_price_per_lf), material, "quantity x length x ply count")];
  if (labor > 0) items.push(line(`member_${index + 1}_labor`, `${member.name} labor`, "Installation labor", quantity, "each", number(member.labor_price_each), labor, "quantity x labor price"));
  return { section_id: member.id, name: member.name, category: "Beams and posts", line_items: items, subtotal: moneyString(material + labor), unresolved: member.resolution === "tbd" };
}

function calculateRoof(roof, index) {
  const length = number(roof.building_length_ft); const span = number(roof.span_ft); const spacing = Math.max(1, number(roof.spacing_in));
  const slope = Math.sqrt(1 + (number(roof.pitch_rise) / 12) ** 2);
  const slopeLength = (span / 2 + number(roof.overhang_ft)) * slope;
  const items = []; let framingCount = 0;
  if (roof.method === "truss") {
    const count = Math.ceil(length * 12 / spacing) + 1; const special = number(roof.special_truss_count); const standard = Math.max(0, count - special);
    items.push(line(`roof_${index + 1}_trusses`, "Standard roof trusses", "Spacing-based truss count", standard, "truss", number(roof.truss_unit_price), standard * number(roof.truss_unit_price), "ceil(building length / spacing) + 1, less special trusses"));
    if (special > 0) items.push(line(`roof_${index + 1}_special`, "Special trusses", "Gable, girder, or separately priced trusses", special, "truss", number(roof.special_truss_unit_price), special * number(roof.special_truss_unit_price), "entered special truss count"));
    items.push(line(`roof_${index + 1}_labor`, "Truss installation labor", "Set and brace roof trusses", count, "truss", number(roof.truss_labor_price_each), count * number(roof.truss_labor_price_each), "total truss count x labor price"));
    framingCount = count;
  } else {
    const pairs = Math.ceil(length * 12 / spacing) + 1; const rafterCount = pairs * 2; const rafterLf = rafterCount * slopeLength;
    items.push(line(`roof_${index + 1}_rafters`, "Roof rafters", `Stick framing at ${roof.pitch_rise}:12 pitch`, rafterLf, "linear ft", number(roof.rafter_unit_price_per_lf), rafterLf * number(roof.rafter_unit_price_per_lf), `${rafterCount} rafters x slope-adjusted length`));
    items.push(line(`roof_${index + 1}_ridge`, "Ridge board", "Continuous ridge board", length, "linear ft", number(roof.ridge_unit_price_per_lf), length * number(roof.ridge_unit_price_per_lf), "building length"));
    items.push(line(`roof_${index + 1}_labor`, "Rafter installation labor", "Cut and install rafters", rafterCount, "rafter", number(roof.rafter_labor_price_each), rafterCount * number(roof.rafter_labor_price_each), "rafter count x labor price"));
    framingCount = rafterCount;
  }
  if (roof.sheathing_enabled) {
    const roofArea = length * slopeLength * 2; const sheets = Math.ceil(roofArea * (1 + number(roof.sheathing_waste_percent) / 100) / 32);
    items.push(line(`roof_${index + 1}_sheathing`, "Roof sheathing", "4 x 8 panels", sheets, "sheet", number(roof.sheathing_unit_price), sheets * number(roof.sheathing_unit_price), "ceil(slope-adjusted roof area x waste / 32 sq ft)"));
  }
  return { section_id: roof.id, name: roof.name, category: "Roof framing", line_items: items, subtotal: moneyString(items.reduce((sum, item) => sum + number(item.amount), 0)), metrics: { framing_member_count: framingCount, slope_length_ft: numberString(slopeLength) } };
}

export function calculateFramingEstimate(rawInputs) {
  const inputs = normalizeFramingInputsForEditor(rawInputs);
  const sections = [
    ...inputs.wall_sections.map(calculateWall), ...inputs.floor_sections.map(calculateFloor),
    ...inputs.structural_members.map(calculateMember), ...inputs.roof_sections.map(calculateRoof),
  ];
  const lineItems = sections.flatMap((section) => section.line_items);
  let hardwareTotal = 0;
  inputs.hardware_items.forEach((item, index) => {
    const amount = number(item.quantity) * number(item.unit_price); hardwareTotal += amount;
    lineItems.push(line(`hardware_${index + 1}`, item.description, "Hardware, fastener, or adhesive", number(item.quantity), item.unit || "each", number(item.unit_price), amount, "quantity x unit price"));
  });
  const allowanceTotal = inputs.cost_allowances.reduce((sum, item, index) => {
    lineItems.push(line(`allowance_${index + 1}`, item.description, String(item.category || "misc"), 1, "allowance", number(item.price), number(item.price), "entered allowance"));
    return sum + number(item.price);
  }, 0);
  const workTotal = sections.reduce((sum, section) => sum + number(section.subtotal), 0) + hardwareTotal + allowanceTotal;
  const overhead = workTotal * number(inputs.overhead_percent) / 100;
  const costBasis = workTotal + overhead;
  const profitPercent = number(inputs.profit_percent);
  let profit; let sellingPrice;
  if (inputs.profit_method === "margin" && profitPercent > 0) {
    sellingPrice = costBasis / (1 - profitPercent / 100); profit = sellingPrice - costBasis;
  } else { profit = costBasis * profitPercent / 100; sellingPrice = costBasis + profit; }
  const extrasTotal = inputs.extras.reduce((sum, item) => sum + number(item.price), 0);
  const taxable = Math.max(0, sellingPrice + extrasTotal);
  const tax = taxable * number(inputs.tax_percent) / 100;
  const subtotal = taxable + tax;
  const discountValue = Math.max(0, number(inputs.discount_value));
  const discount = inputs.discount_type === "fixed" ? Math.min(subtotal, discountValue) : subtotal * Math.min(100, discountValue) / 100;
  const finalPrice = Math.max(0, subtotal - discount);
  return {
    version: FRAMING_CALCULATION_VERSION, sections, line_items: lineItems, extras: inputs.extras,
    direct_cost: moneyString(workTotal), overhead_amount: moneyString(overhead), cost_basis: moneyString(costBasis),
    profit_amount: moneyString(profit), base_selling_price: moneyString(sellingPrice), extras_subtotal: moneyString(extrasTotal),
    tax_amount: moneyString(tax), subtotal: moneyString(subtotal), discount_amount: moneyString(discount), final_price: moneyString(finalPrice),
    range_low: moneyString(finalPrice * 0.9), range_high: moneyString(finalPrice * 1.1),
    unresolved_items: sections.filter((section) => section.unresolved).map((section) => section.name),
  };
}
