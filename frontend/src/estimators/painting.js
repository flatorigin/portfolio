export const PAINTING_CALCULATION_VERSION = "painting-v4";

let clientId = 0;

function nextId(prefix) {
  clientId += 1;
  return `${prefix}-${Date.now()}-${clientId}`;
}

export function createPaintingSection(overrides = {}) {
  return {
    id: nextId("section"),
    name: "Main Area",
    areas: [],
    floor_area: "500",
    wall_area: "0",
    ceiling_area: "0",
    wall_height: "8",
    wall_unit_price: "3.00",
    ceiling_unit_price: "2.00",
    number_of_coats: "2",
    surfaces: { walls: true, ceilings: false, trim: false },
    wall_condition: "standard_repaint",
    trim_needs_prep: false,
    paint_tier: "standard",
    paint_material: "",
    window_count: "0",
    window_unit_price: "0",
    door_count: "0",
    door_unit_price: "0",
    baseboard_linear_feet: "0",
    baseboard_unit_price: "0",
    trim_linear_feet: "0",
    trim_unit_price: "0",
    notes: "",
    legacy_trim_basis: false,
    ...overrides,
    surfaces: {
      walls: true,
      ceilings: false,
      trim: false,
      ...(overrides.surfaces || {}),
    },
    areas: Array.isArray(overrides.areas) ? overrides.areas : [],
  };
}

export function createDefaultPaintingInputs() {
  return {
    prepared_by: "",
    client_name: "",
    project_location: "",
    material_supplier: "not_specified",
    sections: [createPaintingSection()],
    included_scope: [],
    excluded_scope: [],
    extras: [],
    discount_type: "percent",
    discount_value: "0",
    notes: "",
    output_preference: "detailed",
  };
}

function legacyExtra(item, index) {
  const amount = numberValue(item?.quantity, 1) * numberValue(item?.unit_price);
  return {
    id: `legacy-extra-${index + 1}`,
    description: String(item?.name || item?.description || ""),
    price: formatMoneyValue(amount),
  };
}

export function normalizePaintingInputsForEditor(raw = {}) {
  const defaults = createDefaultPaintingInputs();
  if (Array.isArray(raw.sections)) {
    return {
      ...defaults,
      ...raw,
      sections: raw.sections.length
        ? raw.sections.map((section) => createPaintingSection(section))
        : defaults.sections,
      included_scope: Array.isArray(raw.included_scope) ? raw.included_scope : [],
      excluded_scope: Array.isArray(raw.excluded_scope) ? raw.excluded_scope : [],
      extras: Array.isArray(raw.extras) ? raw.extras : [],
    };
  }

  const surfaces = raw.surfaces || {};
  const section = createPaintingSection({
    id: "legacy-main-area",
    name: "Main Area",
    floor_area: String(raw.space_size ?? 500),
    wall_height: String(raw.wall_height ?? 8),
    wall_unit_price: String(raw.wall_unit_price ?? 3),
    ceiling_unit_price: String(raw.ceiling_unit_price ?? 2),
    surfaces: {
      walls: surfaces.walls !== false,
      ceilings: !!surfaces.ceilings,
      trim: !!surfaces.trim,
    },
    wall_condition: raw.wall_condition || "standard_repaint",
    trim_needs_prep: !!raw.trim_needs_prep,
    paint_tier: raw.paint_tier || "standard",
    paint_material: raw.paint_material || "",
    legacy_trim_basis: !!surfaces.trim,
  });
  return {
    ...defaults,
    prepared_by: raw.prepared_by || "",
    client_name: raw.client_name || "",
    project_location: raw.project_location || "",
    material_supplier: raw.material_supplier || "not_specified",
    sections: [section],
    extras: (raw.custom_items || []).map(legacyExtra),
    discount_type: raw.discount_type || "percent",
    discount_value: String(raw.discount_value ?? 0),
    notes: raw.notes || "",
  };
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round((numberValue(value) + Number.EPSILON) * 100) / 100;
}

function formatNumber(value) {
  return String(roundMoney(value));
}

function formatMoneyValue(value) {
  return roundMoney(value).toFixed(2);
}

function calculateSection(section, index) {
  const floorArea = Math.max(0, numberValue(section.floor_area));
  const height = Math.min(40, Math.max(6, numberValue(section.wall_height, 8)));
  const coats = Math.min(5, Math.max(1, numberValue(section.number_of_coats, 2)));
  const coatMultiplier = coats / 2;
  const heightMultiplier = height / 8;
  const accessPercent = Math.min(50, Math.max(0, (height - 9) * 5));
  const accessMultiplier = 1 + accessPercent / 100;
  const material = String(section.paint_material || "").trim()
    || (section.paint_tier === "premium" ? "Premium finish" : "Standard finish");
  const lineItems = [];
  let subtotal = 0;

  const addLine = ({ code, name, description, quantity, unit, rate, amount }) => {
    const rounded = roundMoney(amount);
    subtotal = roundMoney(subtotal + rounded);
    lineItems.push({
      code: `section_${index + 1}_${code}`,
      name,
      description,
      quantity: formatNumber(quantity),
      unit,
      rate: formatMoneyValue(rate),
      amount: formatMoneyValue(rounded),
      material,
      labor_note: "Included",
    });
  };

  if (section.surfaces?.walls) {
    const measuredArea = Math.max(0, numberValue(section.wall_area));
    const wallArea = measuredArea || floorArea * 3.5 * heightMultiplier;
    let rate = Math.min(6, Math.max(2, numberValue(section.wall_unit_price, 3))) * coatMultiplier;
    let description = `Prepare and paint wall surfaces; ${formatNumber(coats)} coats`;
    if (section.wall_condition === "new_drywall") {
      rate *= 1.35;
      description = `Prime new drywall with PVA primer and apply ${formatNumber(coats)} finish coats`;
    }
    addLine({ code: "walls", name: "Walls", description, quantity: wallArea, unit: "sq ft", rate, amount: wallArea * rate });
  }

  if (section.surfaces?.ceilings) {
    const measuredArea = Math.max(0, numberValue(section.ceiling_area));
    const ceilingArea = measuredArea || floorArea;
    const rate = Math.min(6, Math.max(2, numberValue(section.ceiling_unit_price, 2))) * coatMultiplier * accessMultiplier;
    let description = `Prepare and paint ceiling surfaces; ${formatNumber(coats)} coats`;
    if (accessPercent > 0) description += ` with ${formatNumber(accessPercent)}% high-access allowance`;
    addLine({ code: "ceilings", name: "Ceilings", description, quantity: ceilingArea, unit: "sq ft", rate, amount: ceilingArea * rate });
  }

  if (section.legacy_trim_basis && section.surfaces?.trim) {
    const rate = 1.5 * (section.trim_needs_prep ? 1.5 : 1);
    addLine({ code: "trim", name: "Baseboards & trim", description: "Prepare and paint baseboards and trim", quantity: floorArea, unit: "floor sq ft basis", rate, amount: floorArea * rate });
  }

  [
    ["windows", "Windows", "window_count", "window_unit_price", "window"],
    ["doors", "Doors", "door_count", "door_unit_price", "door"],
    ["baseboards", "Baseboards", "baseboard_linear_feet", "baseboard_unit_price", "linear ft"],
    ["trim", "Trim", "trim_linear_feet", "trim_unit_price", "linear ft"],
  ].forEach(([code, name, quantityKey, priceKey, unit]) => {
    const quantity = Math.max(0, numberValue(section[quantityKey]));
    const baseRate = Math.max(0, numberValue(section[priceKey]));
    if (quantity <= 0) return;
    const modifier = section.trim_needs_prep && ["baseboards", "trim"].includes(code) ? 1.5 : 1;
    const rate = baseRate * modifier;
    const description = modifier > 1
      ? `Repair, caulk, prepare, and paint ${name.toLowerCase()}`
      : `Prepare and paint ${name.toLowerCase()}`;
    addLine({ code, name, description, quantity, unit, rate, amount: quantity * rate });
  });

  if (section.paint_tier === "premium" && subtotal > 0) {
    const premium = roundMoney(subtotal * 0.15);
    addLine({ code: "premium_paint", name: "Premium paint", description: "Premium material and finish allowance", quantity: 1, unit: "allowance", rate: premium, amount: premium });
  }

  return {
    section_id: section.id,
    name: section.name,
    areas: section.areas || [],
    line_items: lineItems,
    subtotal: formatMoneyValue(subtotal),
    assumptions: {
      wall_height: formatNumber(height),
      wall_height_multiplier: formatNumber(heightMultiplier),
      number_of_coats: formatNumber(coats),
      ceiling_access_surcharge_percent: formatNumber(accessPercent),
    },
  };
}

export function calculatePaintingEstimate(rawInputs) {
  const inputs = normalizePaintingInputsForEditor(rawInputs);
  const sections = inputs.sections.map(calculateSection);
  const mainSubtotal = roundMoney(sections.reduce((sum, section) => sum + numberValue(section.subtotal), 0));
  const extras = (inputs.extras || [])
    .filter((extra) => String(extra.description || "").trim() || String(extra.price ?? "").trim())
    .map((extra) => ({ ...extra, price: formatMoneyValue(numberValue(extra.price)) }));
  const extrasSubtotal = roundMoney(extras.reduce((sum, extra) => sum + numberValue(extra.price), 0));
  const subtotal = roundMoney(Math.max(0, mainSubtotal + extrasSubtotal));
  const discountValue = Math.max(0, numberValue(inputs.discount_value));
  const discountAmount = inputs.discount_type === "fixed"
    ? Math.min(subtotal, roundMoney(discountValue))
    : roundMoney(subtotal * Math.min(100, discountValue) / 100);
  const finalPrice = roundMoney(Math.max(0, subtotal - discountAmount));
  return {
    version: PAINTING_CALCULATION_VERSION,
    sections,
    line_items: sections.flatMap((section) => section.line_items),
    extras,
    assumptions: sections[0]?.assumptions || {},
    main_painting_subtotal: formatMoneyValue(mainSubtotal),
    extras_subtotal: formatMoneyValue(extrasSubtotal),
    subtotal: formatMoneyValue(subtotal),
    discount_amount: formatMoneyValue(discountAmount),
    final_price: formatMoneyValue(finalPrice),
    range_low: formatMoneyValue(finalPrice * 0.9),
    range_high: formatMoneyValue(finalPrice * 1.1),
  };
}
