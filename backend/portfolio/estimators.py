from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from rest_framework import serializers


MONEY_PLACES = Decimal("0.01")
QUANTITY_PLACES = Decimal("0.01")
PAINTING_CALCULATION_VERSION = "painting-v2"


def _decimal(value, field_name, *, minimum=Decimal("0"), maximum=None):
    try:
        number = Decimal(str(value if value not in (None, "") else "0"))
    except (InvalidOperation, TypeError, ValueError):
        raise serializers.ValidationError({field_name: "Enter a valid number."})

    if not number.is_finite() or number < minimum:
        raise serializers.ValidationError(
            {field_name: f"Enter a value of at least {minimum}."}
        )
    if maximum is not None and number > maximum:
        raise serializers.ValidationError(
            {field_name: f"Enter a value no greater than {maximum}."}
        )
    return number


def _money(value):
    return value.quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def _number_string(value):
    normalized = value.quantize(QUANTITY_PLACES, rounding=ROUND_HALF_UP)
    return format(normalized.normalize(), "f")


def _money_string(value):
    return format(_money(value), ".2f")


def normalize_painting_inputs(raw_inputs):
    if not isinstance(raw_inputs, dict):
        raise serializers.ValidationError({"inputs": "Estimate inputs must be an object."})

    space_size = _decimal(
        raw_inputs.get("space_size"),
        "space_size",
        minimum=Decimal("1"),
        maximum=Decimal("100000"),
    )
    wall_height = _decimal(
        raw_inputs.get("wall_height", 8),
        "wall_height",
        minimum=Decimal("6"),
        maximum=Decimal("40"),
    )

    raw_surfaces = raw_inputs.get("surfaces") or {}
    if not isinstance(raw_surfaces, dict):
        raise serializers.ValidationError({"surfaces": "Surfaces must be an object."})
    surfaces = {
        "walls": bool(raw_surfaces.get("walls", True)),
        "ceilings": bool(raw_surfaces.get("ceilings", False)),
        "trim": bool(raw_surfaces.get("trim", False)),
    }

    wall_condition = str(raw_inputs.get("wall_condition") or "standard_repaint").strip()
    if wall_condition not in {"standard_repaint", "new_drywall"}:
        raise serializers.ValidationError(
            {"wall_condition": "Choose standard repaint or new drywall."}
        )

    paint_tier = str(raw_inputs.get("paint_tier") or "standard").strip()
    if paint_tier not in {"standard", "premium"}:
        raise serializers.ValidationError(
            {"paint_tier": "Choose standard or premium paint."}
        )

    material_supplier = str(
        raw_inputs.get("material_supplier") or "not_specified"
    ).strip()
    if material_supplier not in {"contractor", "client", "not_specified"}:
        raise serializers.ValidationError(
            {"material_supplier": "Choose who supplies the materials."}
        )

    discount_type = str(raw_inputs.get("discount_type") or "percent").strip()
    if discount_type not in {"percent", "fixed"}:
        raise serializers.ValidationError(
            {"discount_type": "Choose a percentage or fixed discount."}
        )
    discount_maximum = Decimal("100") if discount_type == "percent" else Decimal("10000000")
    discount_value = _decimal(
        raw_inputs.get("discount_value", 0),
        "discount_value",
        maximum=discount_maximum,
    )

    raw_custom_items = raw_inputs.get("custom_items") or []
    if not isinstance(raw_custom_items, list):
        raise serializers.ValidationError({"custom_items": "Custom items must be a list."})
    if len(raw_custom_items) > 25:
        raise serializers.ValidationError({"custom_items": "Add up to 25 custom items."})

    custom_items = []
    for index, item in enumerate(raw_custom_items):
        if not isinstance(item, dict):
            raise serializers.ValidationError(
                {"custom_items": f"Custom item {index + 1} must be an object."}
            )
        name = str(item.get("name") or "").strip()[:120]
        if not name:
            raise serializers.ValidationError(
                {"custom_items": f"Custom item {index + 1} needs a name."}
            )
        quantity = _decimal(
            item.get("quantity", 1),
            f"custom_items.{index}.quantity",
            minimum=Decimal("0.01"),
            maximum=Decimal("100000"),
        )
        unit_price = _decimal(
            item.get("unit_price", 0),
            f"custom_items.{index}.unit_price",
            maximum=Decimal("10000000"),
        )
        custom_items.append(
            {
                "name": name,
                "description": str(item.get("description") or "").strip()[:500],
                "quantity": _number_string(quantity),
                "unit": str(item.get("unit") or "each").strip()[:40] or "each",
                "material": str(item.get("material") or "").strip()[:160],
                "labor_note": str(item.get("labor_note") or "Included").strip()[:120],
                "unit_price": _money_string(unit_price),
            }
        )

    if not any(surfaces.values()) and not custom_items:
        raise serializers.ValidationError(
            {"surfaces": "Choose at least one surface or add a custom item."}
        )

    return {
        "prepared_by": str(raw_inputs.get("prepared_by") or "").strip()[:160],
        "client_name": str(raw_inputs.get("client_name") or "").strip()[:160],
        "project_location": str(raw_inputs.get("project_location") or "").strip()[:200],
        "space_size": _number_string(space_size),
        "wall_height": _number_string(wall_height),
        "surfaces": surfaces,
        "wall_condition": wall_condition,
        "trim_needs_prep": bool(raw_inputs.get("trim_needs_prep", False)),
        "paint_tier": paint_tier,
        "paint_material": str(raw_inputs.get("paint_material") or "").strip()[:200],
        "material_supplier": material_supplier,
        "discount_type": discount_type,
        "discount_value": _money_string(discount_value),
        "custom_items": custom_items,
        "notes": str(raw_inputs.get("notes") or "").strip()[:2000],
    }


def calculate_painting_estimate(raw_inputs):
    inputs = normalize_painting_inputs(raw_inputs)
    floor_area = Decimal(inputs["space_size"])
    wall_height = Decimal(inputs["wall_height"])
    wall_height_multiplier = wall_height / Decimal("8")
    ceiling_access_surcharge_percent = min(
        Decimal("50"),
        max(Decimal("0"), (wall_height - Decimal("9")) * Decimal("5")),
    )
    ceiling_access_multiplier = (
        Decimal("1") + ceiling_access_surcharge_percent / Decimal("100")
    )
    surfaces = inputs["surfaces"]
    line_items = []
    painting_subtotal = Decimal("0")

    def add_line(code, name, description, quantity, unit, rate, amount, material=""):
        nonlocal painting_subtotal
        rounded_amount = _money(amount)
        painting_subtotal += rounded_amount
        line_items.append(
            {
                "code": code,
                "name": name,
                "description": description,
                "quantity": _number_string(quantity),
                "unit": unit,
                "rate": _money_string(rate),
                "amount": _money_string(rounded_amount),
                "material": material,
                "labor_note": "Included",
            }
        )

    material = inputs["paint_material"] or (
        "Premium finish" if inputs["paint_tier"] == "premium" else "Standard finish"
    )

    if surfaces["walls"]:
        wall_area = floor_area * Decimal("3.5") * wall_height_multiplier
        wall_amount = wall_area * Decimal("3.00")
        description = "Prepare and paint wall surfaces"
        if inputs["wall_condition"] == "new_drywall":
            wall_amount *= Decimal("1.35")
            description = "Prime new drywall with PVA primer and apply finish coats"
        add_line(
            "walls",
            "Walls",
            description,
            wall_area,
            "sq ft",
            wall_amount / wall_area,
            wall_amount,
            material,
        )

    if surfaces["ceilings"]:
        ceiling_rate = Decimal("2.00") * ceiling_access_multiplier
        ceiling_description = "Prepare and paint ceiling surfaces"
        if ceiling_access_surcharge_percent > 0:
            ceiling_description += (
                f" with {_number_string(ceiling_access_surcharge_percent)}% "
                "high-ceiling access and protection allowance"
            )
        add_line(
            "ceilings",
            "Ceilings",
            ceiling_description,
            floor_area,
            "sq ft",
            ceiling_rate,
            floor_area * ceiling_rate,
            material,
        )

    if surfaces["trim"]:
        trim_amount = floor_area * Decimal("1.50")
        description = "Prepare and paint baseboards and trim"
        if inputs["trim_needs_prep"]:
            trim_amount *= Decimal("1.50")
            description = "Repair joints, caulk, prepare, and paint baseboards and trim"
        add_line(
            "trim",
            "Baseboards & trim",
            description,
            floor_area,
            "floor sq ft basis",
            trim_amount / floor_area,
            trim_amount,
            material,
        )

    if inputs["paint_tier"] == "premium" and painting_subtotal > 0:
        premium_amount = _money(painting_subtotal * Decimal("0.15"))
        line_items.append(
            {
                "code": "premium_paint",
                "name": "Premium paint",
                "description": "Premium material and finish allowance",
                "quantity": "1",
                "unit": "allowance",
                "rate": _money_string(premium_amount),
                "amount": _money_string(premium_amount),
                "material": material,
                "labor_note": "Included",
            }
        )
        painting_subtotal += premium_amount

    custom_subtotal = Decimal("0")
    for index, item in enumerate(inputs["custom_items"]):
        quantity = Decimal(item["quantity"])
        unit_price = Decimal(item["unit_price"])
        amount = _money(quantity * unit_price)
        custom_subtotal += amount
        line_items.append(
            {
                "code": f"custom_{index + 1}",
                "name": item["name"],
                "description": item["description"],
                "quantity": item["quantity"],
                "unit": item["unit"],
                "rate": item["unit_price"],
                "amount": _money_string(amount),
                "material": item["material"],
                "labor_note": item["labor_note"] or "Included",
            }
        )

    subtotal = _money(painting_subtotal + custom_subtotal)
    discount_value = Decimal(inputs["discount_value"])
    if inputs["discount_type"] == "percent":
        discount_amount = _money(subtotal * discount_value / Decimal("100"))
    else:
        discount_amount = min(_money(discount_value), subtotal)
    final_price = _money(max(Decimal("0"), subtotal - discount_amount))

    return inputs, {
        "version": PAINTING_CALCULATION_VERSION,
        "assumptions": {
            "wall_height": _number_string(wall_height),
            "wall_height_multiplier": _number_string(wall_height_multiplier),
            "ceiling_access_surcharge_percent": _number_string(
                ceiling_access_surcharge_percent
            ),
        },
        "line_items": line_items,
        "subtotal": _money_string(subtotal),
        "discount_amount": _money_string(discount_amount),
        "final_price": _money_string(final_price),
        "range_low": _money_string(final_price * Decimal("0.90")),
        "range_high": _money_string(final_price * Decimal("1.10")),
    }
