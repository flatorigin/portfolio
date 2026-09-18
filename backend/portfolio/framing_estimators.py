import math
from decimal import Decimal, ROUND_CEILING

from rest_framework import serializers

from .estimators import (
    _clean_list,
    _decimal,
    _money,
    _money_string,
    _number_string,
    _signed_decimal,
)


FRAMING_CALCULATION_VERSION = "framing-v1"


def _choice(value, field_name, choices, default):
    cleaned = str(value or default).strip()
    if cleaned not in choices:
        raise serializers.ValidationError({field_name: f"Choose one of: {', '.join(choices)}."})
    return cleaned


def _ceil(value):
    return int(Decimal(value).to_integral_value(rounding=ROUND_CEILING))


def _id(value, fallback):
    return str(value or fallback).strip()[:80]


def _text(value, limit=240):
    return str(value or "").strip()[:limit]


def _normalize_opening(raw, wall_index, opening_index):
    if not isinstance(raw, dict):
        raise serializers.ValidationError({f"wall_sections.{wall_index}.openings": "Each opening must be an object."})
    prefix = f"wall_sections.{wall_index}.openings.{opening_index}"
    opening_type = _choice(raw.get("type"), f"{prefix}.type", {"door", "window"}, "window")
    return {
        "id": _id(raw.get("id"), f"opening-{wall_index + 1}-{opening_index + 1}"),
        "name": _text(raw.get("name") or f"{opening_type.title()} {opening_index + 1}", 120),
        "type": opening_type,
        "position_ft": _number_string(_decimal(raw.get("position_ft", 0), f"{prefix}.position_ft", maximum=Decimal("10000"))),
        "width_ft": _number_string(_decimal(raw.get("width_ft", 3), f"{prefix}.width_ft", minimum=Decimal("0.1"), maximum=Decimal("100"))),
        "height_ft": _number_string(_decimal(raw.get("height_ft", 6.67), f"{prefix}.height_ft", minimum=Decimal("0.1"), maximum=Decimal("100"))),
        "sill_height_ft": _number_string(_decimal(raw.get("sill_height_ft", 3 if opening_type == "window" else 0), f"{prefix}.sill_height_ft", maximum=Decimal("100"))),
        "king_studs_per_side": _number_string(_decimal(raw.get("king_studs_per_side", 1), f"{prefix}.king_studs_per_side", maximum=Decimal("10"))),
        "jack_studs_per_side": _number_string(_decimal(raw.get("jack_studs_per_side", 1), f"{prefix}.jack_studs_per_side", maximum=Decimal("10"))),
        "header_description": _text(raw.get("header_description"), 160),
        "header_ply_count": _number_string(_decimal(raw.get("header_ply_count", 2), f"{prefix}.header_ply_count", minimum=Decimal("1"), maximum=Decimal("10"))),
        "header_unit_price_per_lf": _money_string(_decimal(raw.get("header_unit_price_per_lf", 0), f"{prefix}.header_unit_price_per_lf", maximum=Decimal("10000"))),
    }


def _normalize_wall(raw, index):
    if not isinstance(raw, dict):
        raise serializers.ValidationError({"wall_sections": f"Wall assembly {index + 1} must be an object."})
    prefix = f"wall_sections.{index}"
    openings = raw.get("openings") or []
    if not isinstance(openings, list) or len(openings) > 100:
        raise serializers.ValidationError({f"{prefix}.openings": "Add up to 100 openings."})
    return {
        "id": _id(raw.get("id"), f"wall-{index + 1}"),
        "name": _text(raw.get("name") or f"Wall Assembly {index + 1}", 120),
        "level": _text(raw.get("level") or "Main Level", 120),
        "length_ft": _number_string(_decimal(raw.get("length_ft", 20), f"{prefix}.length_ft", minimum=Decimal("0.1"), maximum=Decimal("10000"))),
        "height_ft": _number_string(_decimal(raw.get("height_ft", 8), f"{prefix}.height_ft", minimum=Decimal("1"), maximum=Decimal("100"))),
        "wall_type": _choice(raw.get("wall_type"), f"{prefix}.wall_type", {"interior", "exterior"}, "interior"),
        "bearing": _choice(raw.get("bearing"), f"{prefix}.bearing", {"non_bearing", "load_bearing"}, "non_bearing"),
        "stud_size": _text(raw.get("stud_size") or "2x4", 40),
        "stud_spacing_in": _number_string(_decimal(raw.get("stud_spacing_in", 16), f"{prefix}.stud_spacing_in", minimum=Decimal("1"), maximum=Decimal("48"))),
        "bottom_plate_layers": _number_string(_decimal(raw.get("bottom_plate_layers", 1), f"{prefix}.bottom_plate_layers", maximum=Decimal("5"))),
        "top_plate_layers": _number_string(_decimal(raw.get("top_plate_layers", 2), f"{prefix}.top_plate_layers", maximum=Decimal("5"))),
        "blocking_rows": _number_string(_decimal(raw.get("blocking_rows", 0), f"{prefix}.blocking_rows", maximum=Decimal("20"))),
        "corner_count": _number_string(_decimal(raw.get("corner_count", 2), f"{prefix}.corner_count", maximum=Decimal("100"))),
        "corner_extra_studs": _number_string(_decimal(raw.get("corner_extra_studs", 2), f"{prefix}.corner_extra_studs", maximum=Decimal("10"))),
        "intersection_count": _number_string(_decimal(raw.get("intersection_count", 0), f"{prefix}.intersection_count", maximum=Decimal("100"))),
        "intersection_extra_studs": _number_string(_decimal(raw.get("intersection_extra_studs", 2), f"{prefix}.intersection_extra_studs", maximum=Decimal("10"))),
        "stud_unit_price": _money_string(_decimal(raw.get("stud_unit_price", 4.5), f"{prefix}.stud_unit_price", maximum=Decimal("10000"))),
        "plate_unit_price_per_lf": _money_string(_decimal(raw.get("plate_unit_price_per_lf", 1.25), f"{prefix}.plate_unit_price_per_lf", maximum=Decimal("10000"))),
        "blocking_unit_price_per_lf": _money_string(_decimal(raw.get("blocking_unit_price_per_lf", 1.25), f"{prefix}.blocking_unit_price_per_lf", maximum=Decimal("10000"))),
        "stud_waste_percent": _number_string(_decimal(raw.get("stud_waste_percent", 10), f"{prefix}.stud_waste_percent", maximum=Decimal("100"))),
        "plate_waste_percent": _number_string(_decimal(raw.get("plate_waste_percent", 10), f"{prefix}.plate_waste_percent", maximum=Decimal("100"))),
        "sheathing_enabled": bool(raw.get("sheathing_enabled", False)),
        "sheathing_type": _text(raw.get("sheathing_type") or "7/16 in OSB", 120),
        "panel_width_ft": _number_string(_decimal(raw.get("panel_width_ft", 4), f"{prefix}.panel_width_ft", minimum=Decimal("0.1"), maximum=Decimal("20"))),
        "panel_height_ft": _number_string(_decimal(raw.get("panel_height_ft", 8), f"{prefix}.panel_height_ft", minimum=Decimal("0.1"), maximum=Decimal("40"))),
        "sheathing_unit_price": _money_string(_decimal(raw.get("sheathing_unit_price", 18), f"{prefix}.sheathing_unit_price", maximum=Decimal("10000"))),
        "sheathing_waste_percent": _number_string(_decimal(raw.get("sheathing_waste_percent", 10), f"{prefix}.sheathing_waste_percent", maximum=Decimal("100"))),
        "labor_productivity_lf_per_hour": _number_string(_decimal(raw.get("labor_productivity_lf_per_hour", 8), f"{prefix}.labor_productivity_lf_per_hour", minimum=Decimal("0.01"), maximum=Decimal("10000"))),
        "loaded_hourly_rate": _money_string(_decimal(raw.get("loaded_hourly_rate", 75), f"{prefix}.loaded_hourly_rate", maximum=Decimal("10000"))),
        "complexity_factor": _number_string(_decimal(raw.get("complexity_factor", 1), f"{prefix}.complexity_factor", minimum=Decimal("0.1"), maximum=Decimal("10"))),
        "openings": [_normalize_opening(item, index, item_index) for item_index, item in enumerate(openings)],
        "notes": _text(raw.get("notes"), 1000),
    }


def _normalize_floor(raw, index):
    if not isinstance(raw, dict):
        raise serializers.ValidationError({"floor_sections": f"Floor section {index + 1} must be an object."})
    prefix = f"floor_sections.{index}"
    return {
        "id": _id(raw.get("id"), f"floor-{index + 1}"),
        "name": _text(raw.get("name") or f"Floor Section {index + 1}", 120),
        "length_ft": _number_string(_decimal(raw.get("length_ft", 20), f"{prefix}.length_ft", minimum=Decimal("0.1"), maximum=Decimal("10000"))),
        "width_ft": _number_string(_decimal(raw.get("width_ft", 16), f"{prefix}.width_ft", minimum=Decimal("0.1"), maximum=Decimal("10000"))),
        "joist_direction": _choice(raw.get("joist_direction"), f"{prefix}.joist_direction", {"length", "width"}, "width"),
        "joist_spacing_in": _number_string(_decimal(raw.get("joist_spacing_in", 16), f"{prefix}.joist_spacing_in", minimum=Decimal("1"), maximum=Decimal("48"))),
        "joist_size": _text(raw.get("joist_size") or "2x10", 40),
        "joist_unit_price_per_lf": _money_string(_decimal(raw.get("joist_unit_price_per_lf", 2.25), f"{prefix}.joist_unit_price_per_lf", maximum=Decimal("10000"))),
        "rim_board_lf": _number_string(_decimal(raw.get("rim_board_lf", 0), f"{prefix}.rim_board_lf", maximum=Decimal("100000"))),
        "rim_unit_price_per_lf": _money_string(_decimal(raw.get("rim_unit_price_per_lf", 2.5), f"{prefix}.rim_unit_price_per_lf", maximum=Decimal("10000"))),
        "blocking_rows": _number_string(_decimal(raw.get("blocking_rows", 1), f"{prefix}.blocking_rows", maximum=Decimal("20"))),
        "blocking_unit_price_per_lf": _money_string(_decimal(raw.get("blocking_unit_price_per_lf", 1.5), f"{prefix}.blocking_unit_price_per_lf", maximum=Decimal("10000"))),
        "subfloor_enabled": bool(raw.get("subfloor_enabled", True)),
        "subfloor_unit_price": _money_string(_decimal(raw.get("subfloor_unit_price", 32), f"{prefix}.subfloor_unit_price", maximum=Decimal("10000"))),
        "subfloor_waste_percent": _number_string(_decimal(raw.get("subfloor_waste_percent", 10), f"{prefix}.subfloor_waste_percent", maximum=Decimal("100"))),
        "labor_productivity_sqft_per_hour": _number_string(_decimal(raw.get("labor_productivity_sqft_per_hour", 24), f"{prefix}.labor_productivity_sqft_per_hour", minimum=Decimal("0.01"), maximum=Decimal("10000"))),
        "loaded_hourly_rate": _money_string(_decimal(raw.get("loaded_hourly_rate", 75), f"{prefix}.loaded_hourly_rate", maximum=Decimal("10000"))),
        "complexity_factor": _number_string(_decimal(raw.get("complexity_factor", 1), f"{prefix}.complexity_factor", minimum=Decimal("0.1"), maximum=Decimal("10"))),
    }


def _normalize_member(raw, index):
    if not isinstance(raw, dict):
        raise serializers.ValidationError({"structural_members": f"Structural member {index + 1} must be an object."})
    prefix = f"structural_members.{index}"
    return {
        "id": _id(raw.get("id"), f"member-{index + 1}"),
        "name": _text(raw.get("name") or f"Structural Member {index + 1}", 120),
        "member_type": _choice(raw.get("member_type"), f"{prefix}.member_type", {"beam", "post", "header", "other"}, "beam"),
        "description": _text(raw.get("description"), 240),
        "length_ft": _number_string(_decimal(raw.get("length_ft", 10), f"{prefix}.length_ft", maximum=Decimal("10000"))),
        "quantity": _number_string(_decimal(raw.get("quantity", 1), f"{prefix}.quantity", minimum=Decimal("1"), maximum=Decimal("10000"))),
        "ply_count": _number_string(_decimal(raw.get("ply_count", 1), f"{prefix}.ply_count", minimum=Decimal("1"), maximum=Decimal("20"))),
        "unit_price_per_lf": _money_string(_decimal(raw.get("unit_price_per_lf", 0), f"{prefix}.unit_price_per_lf", maximum=Decimal("100000"))),
        "labor_price_each": _money_string(_decimal(raw.get("labor_price_each", 0), f"{prefix}.labor_price_each", maximum=Decimal("100000"))),
        "resolution": _choice(raw.get("resolution"), f"{prefix}.resolution", {"specified", "tbd"}, "tbd"),
    }


def _normalize_roof(raw, index):
    if not isinstance(raw, dict):
        raise serializers.ValidationError({"roof_sections": f"Roof section {index + 1} must be an object."})
    prefix = f"roof_sections.{index}"
    return {
        "id": _id(raw.get("id"), f"roof-{index + 1}"),
        "name": _text(raw.get("name") or f"Roof Section {index + 1}", 120),
        "method": _choice(raw.get("method"), f"{prefix}.method", {"truss", "stick"}, "truss"),
        "building_length_ft": _number_string(_decimal(raw.get("building_length_ft", 30), f"{prefix}.building_length_ft", minimum=Decimal("0.1"), maximum=Decimal("10000"))),
        "span_ft": _number_string(_decimal(raw.get("span_ft", 24), f"{prefix}.span_ft", minimum=Decimal("0.1"), maximum=Decimal("10000"))),
        "spacing_in": _number_string(_decimal(raw.get("spacing_in", 24), f"{prefix}.spacing_in", minimum=Decimal("1"), maximum=Decimal("48"))),
        "pitch_rise": _number_string(_decimal(raw.get("pitch_rise", 6), f"{prefix}.pitch_rise", maximum=Decimal("24"))),
        "overhang_ft": _number_string(_decimal(raw.get("overhang_ft", 1), f"{prefix}.overhang_ft", maximum=Decimal("20"))),
        "truss_unit_price": _money_string(_decimal(raw.get("truss_unit_price", 180), f"{prefix}.truss_unit_price", maximum=Decimal("100000"))),
        "truss_labor_price_each": _money_string(_decimal(raw.get("truss_labor_price_each", 70), f"{prefix}.truss_labor_price_each", maximum=Decimal("100000"))),
        "special_truss_count": _number_string(_decimal(raw.get("special_truss_count", 0), f"{prefix}.special_truss_count", maximum=Decimal("1000"))),
        "special_truss_unit_price": _money_string(_decimal(raw.get("special_truss_unit_price", 0), f"{prefix}.special_truss_unit_price", maximum=Decimal("100000"))),
        "rafter_unit_price_per_lf": _money_string(_decimal(raw.get("rafter_unit_price_per_lf", 2.25), f"{prefix}.rafter_unit_price_per_lf", maximum=Decimal("10000"))),
        "rafter_labor_price_each": _money_string(_decimal(raw.get("rafter_labor_price_each", 45), f"{prefix}.rafter_labor_price_each", maximum=Decimal("100000"))),
        "ridge_unit_price_per_lf": _money_string(_decimal(raw.get("ridge_unit_price_per_lf", 3), f"{prefix}.ridge_unit_price_per_lf", maximum=Decimal("10000"))),
        "sheathing_enabled": bool(raw.get("sheathing_enabled", True)),
        "sheathing_unit_price": _money_string(_decimal(raw.get("sheathing_unit_price", 32), f"{prefix}.sheathing_unit_price", maximum=Decimal("10000"))),
        "sheathing_waste_percent": _number_string(_decimal(raw.get("sheathing_waste_percent", 10), f"{prefix}.sheathing_waste_percent", maximum=Decimal("100"))),
    }


def _normalize_priced_rows(raw_rows, field_name, categories=None):
    if raw_rows in (None, ""):
        return []
    if not isinstance(raw_rows, list) or len(raw_rows) > 100:
        raise serializers.ValidationError({field_name: "Add up to 100 items."})
    rows = []
    for index, raw in enumerate(raw_rows):
        if not isinstance(raw, dict):
            raise serializers.ValidationError({field_name: f"Item {index + 1} must be an object."})
        description = _text(raw.get("description"), 240)
        if not description and raw.get("quantity") in (None, "") and raw.get("price") in (None, ""):
            continue
        if not description:
            raise serializers.ValidationError({field_name: f"Item {index + 1} needs a description."})
        row = {"id": _id(raw.get("id"), f"{field_name}-{index + 1}"), "description": description}
        if field_name == "hardware_items":
            quantity = _decimal(raw.get("quantity", 1), f"{field_name}.{index}.quantity", maximum=Decimal("1000000"))
            unit_price = _decimal(raw.get("unit_price", 0), f"{field_name}.{index}.unit_price", maximum=Decimal("1000000"))
            row.update({"quantity": _number_string(quantity), "unit": _text(raw.get("unit") or "each", 40), "unit_price": _money_string(unit_price)})
        else:
            category = _choice(raw.get("category"), f"{field_name}.{index}.category", categories, "misc")
            row.update({"category": category, "price": _money_string(_decimal(raw.get("price", 0), f"{field_name}.{index}.price", maximum=Decimal("10000000")))})
        rows.append(row)
    return rows


def normalize_framing_inputs(raw_inputs):
    if not isinstance(raw_inputs, dict):
        raise serializers.ValidationError({"inputs": "Estimate inputs must be an object."})
    walls = raw_inputs.get("wall_sections") or []
    floors = raw_inputs.get("floor_sections") or []
    members = raw_inputs.get("structural_members") or []
    roofs = raw_inputs.get("roof_sections") or []
    for value, field in ((walls, "wall_sections"), (floors, "floor_sections"), (members, "structural_members"), (roofs, "roof_sections")):
        if not isinstance(value, list) or len(value) > 50:
            raise serializers.ValidationError({field: "Add up to 50 sections."})
    if not any((walls, floors, members, roofs, raw_inputs.get("hardware_items"), raw_inputs.get("cost_allowances"))):
        raise serializers.ValidationError({"wall_sections": "Add at least one framing scope item."})

    extras = []
    for index, raw in enumerate(raw_inputs.get("extras") or []):
        if not isinstance(raw, dict):
            raise serializers.ValidationError({"extras": f"Extra {index + 1} must be an object."})
        description = _text(raw.get("description"), 240)
        if not description and raw.get("price") in (None, ""):
            continue
        if not description:
            raise serializers.ValidationError({"extras": f"Extra {index + 1} needs a description."})
        extras.append({"id": _id(raw.get("id"), f"extra-{index + 1}"), "description": description, "price": _money_string(_signed_decimal(raw.get("price", 0), f"extras.{index}.price"))})

    profit_method = _choice(raw_inputs.get("profit_method"), "profit_method", {"markup", "margin"}, "markup")
    profit_percent = _decimal(raw_inputs.get("profit_percent", 20), "profit_percent", maximum=Decimal("95") if profit_method == "margin" else Decimal("500"))
    discount_type = _choice(raw_inputs.get("discount_type"), "discount_type", {"percent", "fixed"}, "percent")
    return {
        "prepared_by": _text(raw_inputs.get("prepared_by"), 160),
        "client_name": _text(raw_inputs.get("client_name"), 160),
        "project_location": _text(raw_inputs.get("project_location"), 200),
        "wall_sections": [_normalize_wall(item, index) for index, item in enumerate(walls)],
        "floor_sections": [_normalize_floor(item, index) for index, item in enumerate(floors)],
        "structural_members": [_normalize_member(item, index) for index, item in enumerate(members)],
        "roof_sections": [_normalize_roof(item, index) for index, item in enumerate(roofs)],
        "hardware_items": _normalize_priced_rows(raw_inputs.get("hardware_items"), "hardware_items"),
        "cost_allowances": _normalize_priced_rows(raw_inputs.get("cost_allowances"), "cost_allowances", {"equipment", "delivery", "subcontractor", "misc"}),
        "included_scope": _clean_list(raw_inputs.get("included_scope"), "included_scope"),
        "excluded_scope": _clean_list(raw_inputs.get("excluded_scope"), "excluded_scope"),
        "assumptions": _clean_list(raw_inputs.get("assumptions"), "assumptions"),
        "extras": extras,
        "overhead_percent": _number_string(_decimal(raw_inputs.get("overhead_percent", 10), "overhead_percent", maximum=Decimal("100"))),
        "profit_method": profit_method,
        "profit_percent": _number_string(profit_percent),
        "tax_percent": _number_string(_decimal(raw_inputs.get("tax_percent", 0), "tax_percent", maximum=Decimal("100"))),
        "discount_type": discount_type,
        "discount_value": _money_string(_decimal(raw_inputs.get("discount_value", 0), "discount_value", maximum=Decimal("100") if discount_type == "percent" else Decimal("10000000"))),
        "notes": _text(raw_inputs.get("notes"), 2000),
        "output_preference": _choice(raw_inputs.get("output_preference"), "output_preference", {"detailed", "summary"}, "detailed"),
    }


def _line(code, name, description, quantity, unit, rate, amount, trace):
    return {"code": code, "name": name, "description": description, "quantity": _number_string(Decimal(quantity)), "unit": unit, "rate": _money_string(Decimal(rate)), "amount": _money_string(_money(Decimal(amount))), "trace": trace}


def _calculate_wall(wall, index):
    length = Decimal(wall["length_ft"])
    height = Decimal(wall["height_ft"])
    spacing = Decimal(wall["stud_spacing_in"])
    base_positions = _ceil(length * 12 / spacing) + 1
    interrupted = set()
    opening_area = Decimal("0")
    opening_additions = 0
    header_lf = Decimal("0")
    for opening in wall["openings"]:
        start = Decimal(opening["position_ft"]) * 12
        end = start + Decimal(opening["width_ft"]) * 12
        for position_index in range(base_positions):
            position = Decimal(position_index) * spacing
            if start < position < end:
                interrupted.add(position_index)
        interrupted_count = max(1, sum(1 for i in range(base_positions) if start < Decimal(i) * spacing < end))
        opening_additions += int(Decimal(opening["king_studs_per_side"]) * 2 + Decimal(opening["jack_studs_per_side"]) * 2)
        opening_additions += interrupted_count
        if opening["type"] == "window":
            opening_additions += interrupted_count
        opening_area += Decimal(opening["width_ft"]) * Decimal(opening["height_ft"])
        header_lf += (Decimal(opening["width_ft"]) + Decimal(opening["jack_studs_per_side"]) * Decimal("0.25")) * Decimal(opening["header_ply_count"])
    corner_additions = int(Decimal(wall["corner_count"]) * Decimal(wall["corner_extra_studs"]))
    intersection_additions = int(Decimal(wall["intersection_count"]) * Decimal(wall["intersection_extra_studs"]))
    raw_studs = max(0, base_positions - len(interrupted) + opening_additions + corner_additions + intersection_additions)
    ordered_studs = _ceil(Decimal(raw_studs) * (1 + Decimal(wall["stud_waste_percent"]) / 100))
    plate_raw_lf = length * (Decimal(wall["bottom_plate_layers"]) + Decimal(wall["top_plate_layers"]))
    plate_order_lf = Decimal(_ceil(plate_raw_lf * (1 + Decimal(wall["plate_waste_percent"]) / 100)))
    blocking_lf = length * Decimal(wall["blocking_rows"])
    line_items = [
        _line(f"wall_{index + 1}_studs", "Wall studs", f"{wall['stud_size']} studs including openings, corners, and intersections", ordered_studs, "stud", Decimal(wall["stud_unit_price"]), Decimal(ordered_studs) * Decimal(wall["stud_unit_price"]), f"ceil(({base_positions} base - {len(interrupted)} interrupted + {opening_additions} opening + {corner_additions + intersection_additions} connection studs) x waste)"),
        _line(f"wall_{index + 1}_plates", "Top and bottom plates", "Plate stock; door openings are not deducted", plate_order_lf, "linear ft", Decimal(wall["plate_unit_price_per_lf"]), plate_order_lf * Decimal(wall["plate_unit_price_per_lf"]), f"{_number_string(length)} ft x {wall['bottom_plate_layers']} bottom + {wall['top_plate_layers']} top layers, then waste"),
    ]
    if blocking_lf > 0:
        line_items.append(_line(f"wall_{index + 1}_blocking", "Wall blocking", f"{wall['blocking_rows']} continuous blocking row(s)", blocking_lf, "linear ft", Decimal(wall["blocking_unit_price_per_lf"]), blocking_lf * Decimal(wall["blocking_unit_price_per_lf"]), "wall length x blocking rows"))
    if header_lf > 0:
        header_cost = sum((Decimal(opening["header_unit_price_per_lf"]) * (Decimal(opening["width_ft"]) + Decimal(opening["jack_studs_per_side"]) * Decimal("0.25")) * Decimal(opening["header_ply_count"]) for opening in wall["openings"]), Decimal("0"))
        line_items.append(_line(f"wall_{index + 1}_headers", "Opening headers", "Specified header stock for doors and windows", header_lf, "linear ft", header_cost / header_lf if header_lf else 0, header_cost, "opening width plus jack bearing, multiplied by header ply count"))
    if wall["sheathing_enabled"]:
        net_area = max(Decimal("0"), length * height - opening_area)
        panel_area = Decimal(wall["panel_width_ft"]) * Decimal(wall["panel_height_ft"])
        sheet_count = _ceil(net_area * (1 + Decimal(wall["sheathing_waste_percent"]) / 100) / panel_area)
        line_items.append(_line(f"wall_{index + 1}_sheathing", "Wall sheathing", wall["sheathing_type"], sheet_count, "sheet", Decimal(wall["sheathing_unit_price"]), Decimal(sheet_count) * Decimal(wall["sheathing_unit_price"]), f"ceil(({_number_string(length * height)} gross sq ft - {_number_string(opening_area)} openings) x waste / {_number_string(panel_area)} sq ft per panel)"))
    labor_hours = length / Decimal(wall["labor_productivity_lf_per_hour"]) * Decimal(wall["complexity_factor"])
    line_items.append(_line(f"wall_{index + 1}_labor", "Wall framing labor", f"Loaded labor at {wall['complexity_factor']}x complexity", labor_hours, "hour", Decimal(wall["loaded_hourly_rate"]), labor_hours * Decimal(wall["loaded_hourly_rate"]), "wall length / productivity x complexity"))
    subtotal = sum((Decimal(item["amount"]) for item in line_items), Decimal("0"))
    return {"section_id": wall["id"], "name": wall["name"], "category": "Wall framing", "line_items": line_items, "subtotal": _money_string(subtotal), "metrics": {"base_stud_positions": base_positions, "interrupted_studs": len(interrupted), "ordered_studs": ordered_studs, "net_sheathing_area": _number_string(max(Decimal("0"), length * height - opening_area))}}


def _calculate_floor(floor, index):
    length, width = Decimal(floor["length_ft"]), Decimal(floor["width_ft"])
    distributed = length if floor["joist_direction"] == "width" else width
    member_length = width if floor["joist_direction"] == "width" else length
    count = _ceil(distributed * 12 / Decimal(floor["joist_spacing_in"])) + 1
    joist_lf = Decimal(count) * member_length
    rim_lf = Decimal(floor["rim_board_lf"]) or (length + width) * 2
    block_count = max(0, count - 1) * int(Decimal(floor["blocking_rows"]))
    block_lf = Decimal(block_count) * Decimal(floor["joist_spacing_in"]) / 12
    area = length * width
    lines = [
        _line(f"floor_{index + 1}_joists", "Floor joists", floor["joist_size"], joist_lf, "linear ft", Decimal(floor["joist_unit_price_per_lf"]), joist_lf * Decimal(floor["joist_unit_price_per_lf"]), f"{count} joists x {_number_string(member_length)} ft"),
        _line(f"floor_{index + 1}_rim", "Rim board", "Perimeter rim board", rim_lf, "linear ft", Decimal(floor["rim_unit_price_per_lf"]), rim_lf * Decimal(floor["rim_unit_price_per_lf"]), "entered rim length or full perimeter"),
    ]
    if block_lf > 0:
        lines.append(_line(f"floor_{index + 1}_blocking", "Joist blocking", f"{floor['blocking_rows']} row(s)", block_lf, "linear ft", Decimal(floor["blocking_unit_price_per_lf"]), block_lf * Decimal(floor["blocking_unit_price_per_lf"]), "(joist count - 1) x rows x spacing"))
    if floor["subfloor_enabled"]:
        sheets = _ceil(area * (1 + Decimal(floor["subfloor_waste_percent"]) / 100) / Decimal("32"))
        lines.append(_line(f"floor_{index + 1}_subfloor", "Subfloor panels", "4 x 8 panels", sheets, "sheet", Decimal(floor["subfloor_unit_price"]), Decimal(sheets) * Decimal(floor["subfloor_unit_price"]), "ceil(floor area x waste / 32 sq ft)"))
    hours = area / Decimal(floor["labor_productivity_sqft_per_hour"]) * Decimal(floor["complexity_factor"])
    lines.append(_line(f"floor_{index + 1}_labor", "Floor framing labor", f"Loaded labor at {floor['complexity_factor']}x complexity", hours, "hour", Decimal(floor["loaded_hourly_rate"]), hours * Decimal(floor["loaded_hourly_rate"]), "floor area / productivity x complexity"))
    subtotal = sum((Decimal(item["amount"]) for item in lines), Decimal("0"))
    return {"section_id": floor["id"], "name": floor["name"], "category": "Floor framing", "line_items": lines, "subtotal": _money_string(subtotal), "metrics": {"joist_count": count, "floor_area": _number_string(area), "blocking_count": block_count}}


def _calculate_member(member, index):
    quantity, length, ply = Decimal(member["quantity"]), Decimal(member["length_ft"]), Decimal(member["ply_count"])
    total_lf = quantity * length * ply
    material = total_lf * Decimal(member["unit_price_per_lf"])
    labor = quantity * Decimal(member["labor_price_each"])
    lines = [_line(f"member_{index + 1}_material", member["name"], member["description"] or member["member_type"].title(), total_lf, "linear ft", Decimal(member["unit_price_per_lf"]), material, "quantity x length x ply count")]
    if labor > 0:
        lines.append(_line(f"member_{index + 1}_labor", f"{member['name']} labor", "Installation labor", quantity, "each", Decimal(member["labor_price_each"]), labor, "quantity x labor price"))
    return {"section_id": member["id"], "name": member["name"], "category": "Beams and posts", "line_items": lines, "subtotal": _money_string(material + labor), "unresolved": member["resolution"] == "tbd"}


def _calculate_roof(roof, index):
    length, span, spacing = Decimal(roof["building_length_ft"]), Decimal(roof["span_ft"]), Decimal(roof["spacing_in"])
    lines = []
    slope = Decimal(str(math.sqrt(1 + (float(Decimal(roof["pitch_rise"]) / 12) ** 2))))
    slope_length = (span / 2 + Decimal(roof["overhang_ft"])) * slope
    if roof["method"] == "truss":
        count = _ceil(length * 12 / spacing) + 1
        standard_count = max(0, count - int(Decimal(roof["special_truss_count"])))
        lines.append(_line(f"roof_{index + 1}_trusses", "Standard roof trusses", "Spacing-based truss count", standard_count, "truss", Decimal(roof["truss_unit_price"]), Decimal(standard_count) * Decimal(roof["truss_unit_price"]), "ceil(building length / spacing) + 1, less special trusses"))
        special_count = Decimal(roof["special_truss_count"])
        if special_count > 0:
            lines.append(_line(f"roof_{index + 1}_special", "Special trusses", "Gable, girder, or other separately priced trusses", special_count, "truss", Decimal(roof["special_truss_unit_price"]), special_count * Decimal(roof["special_truss_unit_price"]), "entered special truss count"))
        lines.append(_line(f"roof_{index + 1}_labor", "Truss installation labor", "Set and brace roof trusses", count, "truss", Decimal(roof["truss_labor_price_each"]), Decimal(count) * Decimal(roof["truss_labor_price_each"]), "total truss count x labor price"))
        framing_count = count
    else:
        pairs = _ceil(length * 12 / spacing) + 1
        rafter_count = pairs * 2
        rafter_lf = Decimal(rafter_count) * slope_length
        lines.extend([
            _line(f"roof_{index + 1}_rafters", "Roof rafters", f"Stick framing at {roof['pitch_rise']}:12 pitch", rafter_lf, "linear ft", Decimal(roof["rafter_unit_price_per_lf"]), rafter_lf * Decimal(roof["rafter_unit_price_per_lf"]), f"{rafter_count} rafters x slope-adjusted length"),
            _line(f"roof_{index + 1}_ridge", "Ridge board", "Continuous ridge board", length, "linear ft", Decimal(roof["ridge_unit_price_per_lf"]), length * Decimal(roof["ridge_unit_price_per_lf"]), "building length"),
            _line(f"roof_{index + 1}_labor", "Rafter installation labor", "Cut and install rafters", rafter_count, "rafter", Decimal(roof["rafter_labor_price_each"]), Decimal(rafter_count) * Decimal(roof["rafter_labor_price_each"]), "rafter count x labor price"),
        ])
        framing_count = rafter_count
    if roof["sheathing_enabled"]:
        roof_area = length * slope_length * 2
        sheets = _ceil(roof_area * (1 + Decimal(roof["sheathing_waste_percent"]) / 100) / Decimal("32"))
        lines.append(_line(f"roof_{index + 1}_sheathing", "Roof sheathing", "4 x 8 panels", sheets, "sheet", Decimal(roof["sheathing_unit_price"]), Decimal(sheets) * Decimal(roof["sheathing_unit_price"]), "ceil(slope-adjusted roof area x waste / 32 sq ft)"))
    subtotal = sum((Decimal(item["amount"]) for item in lines), Decimal("0"))
    return {"section_id": roof["id"], "name": roof["name"], "category": "Roof framing", "line_items": lines, "subtotal": _money_string(subtotal), "metrics": {"framing_member_count": framing_count, "slope_length_ft": _number_string(slope_length)}}


def calculate_framing_estimate(raw_inputs):
    inputs = normalize_framing_inputs(raw_inputs)
    sections = []
    sections.extend(_calculate_wall(item, index) for index, item in enumerate(inputs["wall_sections"]))
    sections.extend(_calculate_floor(item, index) for index, item in enumerate(inputs["floor_sections"]))
    sections.extend(_calculate_member(item, index) for index, item in enumerate(inputs["structural_members"]))
    sections.extend(_calculate_roof(item, index) for index, item in enumerate(inputs["roof_sections"]))
    line_items = [item for section in sections for item in section["line_items"]]
    hardware_total = Decimal("0")
    for index, item in enumerate(inputs["hardware_items"]):
        amount = Decimal(item["quantity"]) * Decimal(item["unit_price"])
        hardware_total += amount
        line_items.append(_line(f"hardware_{index + 1}", item["description"], "Hardware, fastener, or adhesive", Decimal(item["quantity"]), item["unit"], Decimal(item["unit_price"]), amount, "quantity x unit price"))
    allowance_total = sum((Decimal(item["price"]) for item in inputs["cost_allowances"]), Decimal("0"))
    for index, item in enumerate(inputs["cost_allowances"]):
        line_items.append(_line(f"allowance_{index + 1}", item["description"], item["category"].title(), 1, "allowance", Decimal(item["price"]), Decimal(item["price"]), "entered allowance"))
    work_total = sum((Decimal(section["subtotal"]) for section in sections), Decimal("0")) + hardware_total + allowance_total
    overhead = _money(work_total * Decimal(inputs["overhead_percent"]) / 100)
    cost_basis = work_total + overhead
    profit_percent = Decimal(inputs["profit_percent"])
    if inputs["profit_method"] == "margin" and profit_percent > 0:
        selling_price = _money(cost_basis / (1 - profit_percent / 100))
        profit = selling_price - cost_basis
    else:
        profit = _money(cost_basis * profit_percent / 100)
        selling_price = cost_basis + profit
    extras_total = sum((Decimal(item["price"]) for item in inputs["extras"]), Decimal("0"))
    taxable = max(Decimal("0"), selling_price + extras_total)
    tax = _money(taxable * Decimal(inputs["tax_percent"]) / 100)
    subtotal = _money(taxable + tax)
    discount_value = Decimal(inputs["discount_value"])
    discount = _money(subtotal * discount_value / 100) if inputs["discount_type"] == "percent" else min(subtotal, _money(discount_value))
    final_price = _money(max(Decimal("0"), subtotal - discount))
    unresolved = [section["name"] for section in sections if section.get("unresolved")]
    return inputs, {
        "version": FRAMING_CALCULATION_VERSION,
        "sections": sections,
        "line_items": line_items,
        "extras": inputs["extras"],
        "direct_cost": _money_string(work_total),
        "overhead_amount": _money_string(overhead),
        "cost_basis": _money_string(cost_basis),
        "profit_amount": _money_string(profit),
        "base_selling_price": _money_string(selling_price),
        "extras_subtotal": _money_string(extras_total),
        "tax_amount": _money_string(tax),
        "subtotal": _money_string(subtotal),
        "discount_amount": _money_string(discount),
        "final_price": _money_string(final_price),
        "range_low": _money_string(final_price * Decimal("0.90")),
        "range_high": _money_string(final_price * Decimal("1.10")),
        "unresolved_items": unresolved,
    }
