from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from rest_framework import serializers


MONEY_PLACES = Decimal("0.01")
QUANTITY_PLACES = Decimal("0.01")
PAINTING_CALCULATION_VERSION = "painting-v4"


def _decimal(value, field_name, *, minimum=Decimal("0"), maximum=None):
    try:
        number = Decimal(str(value if value not in (None, "") else "0"))
    except (InvalidOperation, TypeError, ValueError):
        raise serializers.ValidationError({field_name: "Enter a valid number."})
    if not number.is_finite() or number < minimum:
        raise serializers.ValidationError({field_name: f"Enter a value of at least {minimum}."})
    if maximum is not None and number > maximum:
        raise serializers.ValidationError({field_name: f"Enter a value no greater than {maximum}."})
    return number


def _signed_decimal(value, field_name, *, maximum=Decimal("10000000")):
    try:
        number = Decimal(str(value if value not in (None, "") else "0"))
    except (InvalidOperation, TypeError, ValueError):
        raise serializers.ValidationError({field_name: "Enter a valid number."})
    if not number.is_finite() or abs(number) > maximum:
        raise serializers.ValidationError({field_name: f"Enter a value between {-maximum} and {maximum}."})
    return number


def _money(value):
    return value.quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def _number_string(value):
    return format(value.quantize(QUANTITY_PLACES, rounding=ROUND_HALF_UP).normalize(), "f")


def _money_string(value):
    return format(_money(value), ".2f")


def _clean_list(value, field_name, *, limit=100, item_length=240):
    if value in (None, ""):
        return []
    if isinstance(value, str):
        value = value.splitlines()
    if not isinstance(value, list):
        raise serializers.ValidationError({field_name: "Enter a list of items."})
    if len(value) > limit:
        raise serializers.ValidationError({field_name: f"Add up to {limit} items."})
    return [str(item or "").strip()[:item_length] for item in value if str(item or "").strip()]


def _legacy_section(raw_inputs):
    return {
        "id": "legacy-main-area",
        "name": "Main Area",
        "areas": [],
        "floor_area": raw_inputs.get("space_size", 500),
        "wall_area": 0,
        "ceiling_area": 0,
        "wall_height": raw_inputs.get("wall_height", 8),
        "wall_unit_price": raw_inputs.get("wall_unit_price", 3),
        "ceiling_unit_price": raw_inputs.get("ceiling_unit_price", 2),
        "number_of_coats": 2,
        "surfaces": raw_inputs.get("surfaces") or {"walls": True, "ceilings": False, "trim": False},
        "wall_condition": raw_inputs.get("wall_condition", "standard_repaint"),
        "trim_needs_prep": raw_inputs.get("trim_needs_prep", False),
        "paint_tier": raw_inputs.get("paint_tier", "standard"),
        "paint_material": raw_inputs.get("paint_material", ""),
        "window_count": 0,
        "window_unit_price": 0,
        "door_count": 0,
        "door_unit_price": 0,
        "baseboard_linear_feet": 0,
        "baseboard_unit_price": 0,
        "trim_linear_feet": 0,
        "trim_unit_price": 0,
        "notes": "",
        "legacy_trim_basis": bool((raw_inputs.get("surfaces") or {}).get("trim")),
    }


def _legacy_extras(raw_inputs):
    extras = []
    for index, item in enumerate(raw_inputs.get("custom_items") or []):
        if not isinstance(item, dict):
            continue
        description = str(item.get("name") or item.get("description") or "").strip()
        try:
            amount = Decimal(str(item.get("quantity", 1))) * Decimal(str(item.get("unit_price", 0)))
        except (InvalidOperation, TypeError, ValueError):
            amount = Decimal("0")
        if description or amount:
            extras.append({"id": f"legacy-extra-{index + 1}", "description": description, "price": _money_string(amount)})
    return extras


def _normalize_section(raw_section, index):
    if not isinstance(raw_section, dict):
        raise serializers.ValidationError({"sections": f"Section {index + 1} must be an object."})
    prefix = f"sections.{index}"
    floor_area = _decimal(raw_section.get("floor_area", raw_section.get("space_size")), f"{prefix}.floor_area", minimum=Decimal("1"), maximum=Decimal("100000"))
    wall_area = _decimal(raw_section.get("wall_area", 0), f"{prefix}.wall_area", maximum=Decimal("1000000"))
    ceiling_area = _decimal(raw_section.get("ceiling_area", 0), f"{prefix}.ceiling_area", maximum=Decimal("1000000"))
    wall_height = _decimal(raw_section.get("wall_height", 8), f"{prefix}.wall_height", minimum=Decimal("6"), maximum=Decimal("40"))
    wall_unit_price = _decimal(raw_section.get("wall_unit_price", 3), f"{prefix}.wall_unit_price", minimum=Decimal("2"), maximum=Decimal("6"))
    ceiling_unit_price = _decimal(raw_section.get("ceiling_unit_price", 2), f"{prefix}.ceiling_unit_price", minimum=Decimal("2"), maximum=Decimal("6"))
    coats = _decimal(raw_section.get("number_of_coats", 2), f"{prefix}.number_of_coats", minimum=Decimal("1"), maximum=Decimal("5"))

    raw_surfaces = raw_section.get("surfaces") or {}
    if not isinstance(raw_surfaces, dict):
        raise serializers.ValidationError({f"{prefix}.surfaces": "Surfaces must be an object."})
    surfaces = {
        "walls": bool(raw_surfaces.get("walls", True)),
        "ceilings": bool(raw_surfaces.get("ceilings", False)),
        "trim": bool(raw_surfaces.get("trim", False)),
    }
    wall_condition = str(raw_section.get("wall_condition") or "standard_repaint").strip()
    if wall_condition not in {"standard_repaint", "new_drywall"}:
        raise serializers.ValidationError({f"{prefix}.wall_condition": "Choose standard repaint or new drywall."})
    paint_tier = str(raw_section.get("paint_tier") or "standard").strip()
    if paint_tier not in {"standard", "premium"}:
        raise serializers.ValidationError({f"{prefix}.paint_tier": "Choose standard or premium paint."})

    quantities = {
        key: _decimal(raw_section.get(key, 0), f"{prefix}.{key}", maximum=maximum)
        for key, maximum in {
            "window_count": Decimal("1000"),
            "door_count": Decimal("1000"),
            "baseboard_linear_feet": Decimal("100000"),
            "trim_linear_feet": Decimal("100000"),
        }.items()
    }
    prices = {
        key: _decimal(raw_section.get(key, 0), f"{prefix}.{key}", maximum=Decimal("100000"))
        for key in {"window_unit_price", "door_unit_price", "baseboard_unit_price", "trim_unit_price"}
    }
    if not any(surfaces.values()) and not any(value > 0 for value in quantities.values()):
        raise serializers.ValidationError({f"{prefix}.surfaces": "Choose at least one surface or enter section work."})

    return {
        "id": str(raw_section.get("id") or f"section-{index + 1}")[:80],
        "name": str(raw_section.get("name") or f"Section {index + 1}").strip()[:120],
        "areas": _clean_list(raw_section.get("areas"), f"{prefix}.areas", limit=50),
        "floor_area": _number_string(floor_area),
        "wall_area": _number_string(wall_area),
        "ceiling_area": _number_string(ceiling_area),
        "wall_height": _number_string(wall_height),
        "wall_unit_price": _money_string(wall_unit_price),
        "ceiling_unit_price": _money_string(ceiling_unit_price),
        "number_of_coats": _number_string(coats),
        "surfaces": surfaces,
        "wall_condition": wall_condition,
        "trim_needs_prep": bool(raw_section.get("trim_needs_prep", False)),
        "paint_tier": paint_tier,
        "paint_material": str(raw_section.get("paint_material") or "").strip()[:200],
        "window_count": _number_string(quantities["window_count"]),
        "window_unit_price": _money_string(prices["window_unit_price"]),
        "door_count": _number_string(quantities["door_count"]),
        "door_unit_price": _money_string(prices["door_unit_price"]),
        "baseboard_linear_feet": _number_string(quantities["baseboard_linear_feet"]),
        "baseboard_unit_price": _money_string(prices["baseboard_unit_price"]),
        "trim_linear_feet": _number_string(quantities["trim_linear_feet"]),
        "trim_unit_price": _money_string(prices["trim_unit_price"]),
        "notes": str(raw_section.get("notes") or "").strip()[:1000],
        "legacy_trim_basis": bool(raw_section.get("legacy_trim_basis", False)),
    }


def normalize_painting_inputs(raw_inputs):
    if not isinstance(raw_inputs, dict):
        raise serializers.ValidationError({"inputs": "Estimate inputs must be an object."})
    raw_sections = raw_inputs.get("sections")
    legacy = not isinstance(raw_sections, list)
    if legacy:
        raw_sections = [_legacy_section(raw_inputs)]
    if not raw_sections:
        raise serializers.ValidationError({"sections": "Add at least one painting section."})
    if len(raw_sections) > 50:
        raise serializers.ValidationError({"sections": "Add up to 50 painting sections."})
    sections = [_normalize_section(section, index) for index, section in enumerate(raw_sections)]

    material_supplier = str(raw_inputs.get("material_supplier") or "not_specified").strip()
    if material_supplier not in {"contractor", "client", "not_specified"}:
        raise serializers.ValidationError({"material_supplier": "Choose who supplies the materials."})
    discount_type = str(raw_inputs.get("discount_type") or "percent").strip()
    if discount_type not in {"percent", "fixed"}:
        raise serializers.ValidationError({"discount_type": "Choose a percentage or fixed discount."})
    discount_value = _decimal(raw_inputs.get("discount_value", 0), "discount_value", maximum=Decimal("100") if discount_type == "percent" else Decimal("10000000"))

    raw_extras = _legacy_extras(raw_inputs) if legacy else raw_inputs.get("extras") or []
    if not isinstance(raw_extras, list):
        raise serializers.ValidationError({"extras": "Extras must be a list."})
    if len(raw_extras) > 100:
        raise serializers.ValidationError({"extras": "Add up to 100 extras."})
    extras = []
    for index, extra in enumerate(raw_extras):
        if not isinstance(extra, dict):
            raise serializers.ValidationError({"extras": f"Extra {index + 1} must be an object."})
        description = str(extra.get("description") or "").strip()[:240]
        raw_price = extra.get("price")
        if not description and raw_price in (None, ""):
            continue
        price = _signed_decimal(raw_price, f"extras.{index}.price")
        if not description:
            raise serializers.ValidationError({"extras": f"Extra {index + 1} needs a description."})
        extras.append({"id": str(extra.get("id") or f"extra-{index + 1}")[:80], "description": description, "price": _money_string(price)})

    output_preference = str(raw_inputs.get("output_preference") or "detailed").strip()
    if output_preference not in {"detailed", "summary"}:
        raise serializers.ValidationError({"output_preference": "Choose detailed or summary output."})
    return {
        "prepared_by": str(raw_inputs.get("prepared_by") or "").strip()[:160],
        "client_name": str(raw_inputs.get("client_name") or "").strip()[:160],
        "project_location": str(raw_inputs.get("project_location") or "").strip()[:200],
        "material_supplier": material_supplier,
        "sections": sections,
        "included_scope": _clean_list(raw_inputs.get("included_scope"), "included_scope"),
        "excluded_scope": _clean_list(raw_inputs.get("excluded_scope"), "excluded_scope"),
        "extras": extras,
        "discount_type": discount_type,
        "discount_value": _money_string(discount_value),
        "notes": str(raw_inputs.get("notes") or "").strip()[:2000],
        "output_preference": output_preference,
    }


def _calculate_section(section, index):
    floor_area = Decimal(section["floor_area"])
    wall_height = Decimal(section["wall_height"])
    coat_multiplier = Decimal(section["number_of_coats"]) / Decimal("2")
    height_multiplier = wall_height / Decimal("8")
    access_percent = min(Decimal("50"), max(Decimal("0"), (wall_height - Decimal("9")) * Decimal("5")))
    access_multiplier = Decimal("1") + access_percent / Decimal("100")
    material = section["paint_material"] or ("Premium finish" if section["paint_tier"] == "premium" else "Standard finish")
    line_items = []
    section_subtotal = Decimal("0")

    def add_line(code, name, description, quantity, unit, rate, amount):
        nonlocal section_subtotal
        rounded = _money(amount)
        section_subtotal += rounded
        line_items.append({
            "code": f"section_{index + 1}_{code}",
            "name": name,
            "description": description,
            "quantity": _number_string(quantity),
            "unit": unit,
            "rate": _money_string(rate),
            "amount": _money_string(rounded),
            "material": material,
            "labor_note": "Included",
        })

    if section["surfaces"]["walls"]:
        measured = Decimal(section["wall_area"])
        wall_area = measured if measured > 0 else floor_area * Decimal("3.5") * height_multiplier
        rate = Decimal(section["wall_unit_price"]) * coat_multiplier
        description = f"Prepare and paint wall surfaces; {section['number_of_coats']} coats"
        if section["wall_condition"] == "new_drywall":
            rate *= Decimal("1.35")
            description = f"Prime new drywall with PVA primer and apply {section['number_of_coats']} finish coats"
        add_line("walls", "Walls", description, wall_area, "sq ft", rate, wall_area * rate)

    if section["surfaces"]["ceilings"]:
        measured = Decimal(section["ceiling_area"])
        ceiling_area = measured if measured > 0 else floor_area
        rate = Decimal(section["ceiling_unit_price"]) * coat_multiplier * access_multiplier
        description = f"Prepare and paint ceiling surfaces; {section['number_of_coats']} coats"
        if access_percent > 0:
            description += f" with {_number_string(access_percent)}% high-access allowance"
        add_line("ceilings", "Ceilings", description, ceiling_area, "sq ft", rate, ceiling_area * rate)

    if section["legacy_trim_basis"] and section["surfaces"]["trim"]:
        rate = Decimal("1.50") * (Decimal("1.50") if section["trim_needs_prep"] else Decimal("1"))
        add_line("trim", "Baseboards & trim", "Prepare and paint baseboards and trim", floor_area, "floor sq ft basis", rate, floor_area * rate)

    for code, name, quantity_key, price_key, unit in (
        ("windows", "Windows", "window_count", "window_unit_price", "window"),
        ("doors", "Doors", "door_count", "door_unit_price", "door"),
        ("baseboards", "Baseboards", "baseboard_linear_feet", "baseboard_unit_price", "linear ft"),
        ("trim", "Trim", "trim_linear_feet", "trim_unit_price", "linear ft"),
    ):
        quantity = Decimal(section[quantity_key])
        rate = Decimal(section[price_key])
        if quantity > 0:
            modifier = Decimal("1.50") if section["trim_needs_prep"] and code in {"baseboards", "trim"} else Decimal("1")
            description = f"Prepare and paint {name.lower()}"
            if modifier > 1:
                description = f"Repair, caulk, prepare, and paint {name.lower()}"
            add_line(code, name, description, quantity, unit, rate * modifier, quantity * rate * modifier)

    if section["paint_tier"] == "premium" and section_subtotal > 0:
        premium = _money(section_subtotal * Decimal("0.15"))
        add_line("premium_paint", "Premium paint", "Premium material and finish allowance", Decimal("1"), "allowance", premium, premium)

    return {
        "section_id": section["id"],
        "name": section["name"],
        "areas": section["areas"],
        "line_items": line_items,
        "subtotal": _money_string(section_subtotal),
        "assumptions": {
            "wall_height": section["wall_height"],
            "wall_height_multiplier": _number_string(height_multiplier),
            "number_of_coats": section["number_of_coats"],
            "ceiling_access_surcharge_percent": _number_string(access_percent),
        },
    }


def calculate_painting_estimate(raw_inputs):
    inputs = normalize_painting_inputs(raw_inputs)
    section_results = [_calculate_section(section, index) for index, section in enumerate(inputs["sections"])]
    main_subtotal = _money(sum((Decimal(section["subtotal"]) for section in section_results), Decimal("0")))
    extras_subtotal = _money(sum((Decimal(extra["price"]) for extra in inputs["extras"]), Decimal("0")))
    subtotal = _money(max(Decimal("0"), main_subtotal + extras_subtotal))
    discount_value = Decimal(inputs["discount_value"])
    if inputs["discount_type"] == "percent":
        discount_amount = _money(subtotal * discount_value / Decimal("100"))
    else:
        discount_amount = min(_money(discount_value), subtotal)
    final_price = _money(max(Decimal("0"), subtotal - discount_amount))
    line_items = [item for section in section_results for item in section["line_items"]]
    return inputs, {
        "version": PAINTING_CALCULATION_VERSION,
        "sections": section_results,
        "line_items": line_items,
        "extras": inputs["extras"],
        "assumptions": section_results[0]["assumptions"] if section_results else {},
        "main_painting_subtotal": _money_string(main_subtotal),
        "extras_subtotal": _money_string(extras_subtotal),
        "subtotal": _money_string(subtotal),
        "discount_amount": _money_string(discount_amount),
        "final_price": _money_string(final_price),
        "range_low": _money_string(final_price * Decimal("0.90")),
        "range_high": _money_string(final_price * Decimal("1.10")),
    }
