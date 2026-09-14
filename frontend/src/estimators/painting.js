export const PAINTING_CALCULATION_VERSION = "painting-v1";

export function createDefaultPaintingInputs() {
  return {
    prepared_by: "",
    client_name: "",
    project_location: "",
    space_size: "500",
    surfaces: {
      walls: true,
      ceilings: false,
      trim: false,
    },
    wall_condition: "standard_repaint",
    trim_needs_prep: false,
    paint_tier: "standard",
    paint_material: "",
    material_supplier: "not_specified",
    discount_type: "percent",
    discount_value: "0",
    custom_items: [],
    notes: "",
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

export function calculatePaintingEstimate(inputs) {
  const floorArea = Math.max(0, numberValue(inputs?.space_size));
  const surfaces = inputs?.surfaces || {};
  const material =
    String(inputs?.paint_material || "").trim() ||
    (inputs?.paint_tier === "premium" ? "Premium finish" : "Standard finish");
  const lineItems = [];
  let paintingSubtotal = 0;

  function addLine({ code, name, description, quantity, unit, rate, amount }) {
    const roundedAmount = roundMoney(amount);
    paintingSubtotal = roundMoney(paintingSubtotal + roundedAmount);
    lineItems.push({
      code,
      name,
      description,
      quantity: formatNumber(quantity),
      unit,
      rate: formatMoneyValue(rate),
      amount: formatMoneyValue(roundedAmount),
      material,
      labor_note: "Included",
    });
  }

  if (surfaces.walls) {
    const wallArea = floorArea * 3.5;
    const isNewDrywall = inputs?.wall_condition === "new_drywall";
    const wallRate = 3 * (isNewDrywall ? 1.35 : 1);
    addLine({
      code: "walls",
      name: "Walls",
      description: isNewDrywall
        ? "Prime new drywall with PVA primer and apply finish coats"
        : "Prepare and paint wall surfaces",
      quantity: wallArea,
      unit: "sq ft",
      rate: wallRate,
      amount: wallArea * wallRate,
    });
  }

  if (surfaces.ceilings) {
    addLine({
      code: "ceilings",
      name: "Ceilings",
      description: "Prepare and paint ceiling surfaces",
      quantity: floorArea,
      unit: "sq ft",
      rate: 2,
      amount: floorArea * 2,
    });
  }

  if (surfaces.trim) {
    const needsPrep = !!inputs?.trim_needs_prep;
    const trimRate = 1.5 * (needsPrep ? 1.5 : 1);
    addLine({
      code: "trim",
      name: "Baseboards & trim",
      description: needsPrep
        ? "Repair joints, caulk, prepare, and paint baseboards and trim"
        : "Prepare and paint baseboards and trim",
      quantity: floorArea,
      unit: "floor sq ft basis",
      rate: trimRate,
      amount: floorArea * trimRate,
    });
  }

  if (inputs?.paint_tier === "premium" && paintingSubtotal > 0) {
    const premiumAmount = roundMoney(paintingSubtotal * 0.15);
    lineItems.push({
      code: "premium_paint",
      name: "Premium paint",
      description: "Premium material and finish allowance",
      quantity: "1",
      unit: "allowance",
      rate: formatMoneyValue(premiumAmount),
      amount: formatMoneyValue(premiumAmount),
      material,
      labor_note: "Included",
    });
    paintingSubtotal = roundMoney(paintingSubtotal + premiumAmount);
  }

  let customSubtotal = 0;
  (Array.isArray(inputs?.custom_items) ? inputs.custom_items : []).forEach((item, index) => {
    const quantity = Math.max(0, numberValue(item?.quantity));
    const unitPrice = Math.max(0, numberValue(item?.unit_price));
    const amount = roundMoney(quantity * unitPrice);
    customSubtotal = roundMoney(customSubtotal + amount);
    lineItems.push({
      code: `custom_${index + 1}`,
      name: String(item?.name || "Custom item").trim() || "Custom item",
      description: String(item?.description || "").trim(),
      quantity: formatNumber(quantity),
      unit: String(item?.unit || "each").trim() || "each",
      rate: formatMoneyValue(unitPrice),
      amount: formatMoneyValue(amount),
      material: String(item?.material || "").trim(),
      labor_note: String(item?.labor_note || "Included").trim() || "Included",
    });
  });

  const subtotal = roundMoney(paintingSubtotal + customSubtotal);
  const discountValue = Math.max(0, numberValue(inputs?.discount_value));
  const discountAmount =
    inputs?.discount_type === "fixed"
      ? Math.min(subtotal, roundMoney(discountValue))
      : roundMoney(subtotal * Math.min(discountValue, 100) / 100);
  const finalPrice = roundMoney(Math.max(0, subtotal - discountAmount));

  return {
    version: PAINTING_CALCULATION_VERSION,
    line_items: lineItems,
    subtotal: formatMoneyValue(subtotal),
    discount_amount: formatMoneyValue(discountAmount),
    final_price: formatMoneyValue(finalPrice),
    range_low: formatMoneyValue(finalPrice * 0.9),
    range_high: formatMoneyValue(finalPrice * 1.1),
  };
}
