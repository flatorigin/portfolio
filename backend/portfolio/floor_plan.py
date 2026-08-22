from io import BytesIO
import math

from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError


PLAN_CANVAS_WIDTH = 1200
PLAN_CANVAS_HEIGHT = 760
PLAN_MARGIN = 82
FALLBACK_REFERENCE_INCHES = 12.0


def _number(value, default=0.0, minimum=None, maximum=None):
    try:
        result = float(value)
    except (TypeError, ValueError):
        result = float(default)
    if not math.isfinite(result):
        result = float(default)
    if minimum is not None:
        result = max(float(minimum), result)
    if maximum is not None:
        result = min(float(maximum), result)
    return result


def _confidence(value, default=0.5):
    return round(_number(value, default, 0, 1), 3)


def _clean_id(value, prefix, index):
    cleaned = "".join(character for character in str(value or "") if character.isalnum() or character in "_-")
    return cleaned[:64] or f"{prefix}{index + 1}"


def _clean_text(value, limit=120):
    return " ".join(str(value or "").strip().split())[:limit]


def _unit_to_inches(value, unit):
    factors = {
        "in": 1,
        "inch": 1,
        "inches": 1,
        "ft": 12,
        "foot": 12,
        "feet": 12,
        "cm": 1 / 2.54,
        "mm": 1 / 25.4,
        "m": 39.3700787402,
    }
    return _number(value, 0, 0) * factors.get(str(unit or "").strip().lower(), 0)


def _canonical_unit(unit):
    normalized = str(unit or "").strip().lower()
    aliases = {
        "inch": "in",
        "inches": "in",
        "foot": "ft",
        "feet": "ft",
    }
    normalized = aliases.get(normalized, normalized)
    return normalized if normalized in {"in", "ft", "cm", "mm", "m"} else "in"


def source_image_dimensions(image_bytes):
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            normalized = ImageOps.exif_transpose(image)
            return normalized.size
    except (UnidentifiedImageError, OSError, ValueError):
        return (0, 0)


def build_floor_plan_extraction_prompts(
    *,
    title,
    category,
    location="",
    notes="",
    source_width=0,
    source_height=0,
):
    coordinate_width = 1000
    coordinate_height = (
        max(300, min(1800, round(coordinate_width * source_height / source_width)))
        if source_width and source_height
        else 1000
    )
    system_prompt = (
        "You are a floor-plan topology extraction engine. Read the supplied hand sketch as evidence and return strict JSON only. "
        "Do not redraw, redesign, beautify, or invent rooms, walls, openings, dimensions, or labels. "
        "The result is a homeowner planning schematic, not permit, CAD, engineering, or construction documentation."
    )
    user_prompt = f"""
Extract one connected, semantic 2D floor plan from this hand sketch.

Project title: {title or 'Untitled project'}
Project category: {category or 'general project'}
Project location: {location or 'not provided'}
Project notes: {notes or 'not provided'}
Source image pixels: {source_width or 'unknown'} x {source_height or 'unknown'}

GEOMETRY RULES
1. Use a coordinate plane {coordinate_width} wide by {coordinate_height} high. X increases right and Y increases down. Preserve the source aspect ratio.
2. Trace the actual wall centerlines and footprint. Preserve visible angles, offsets, recesses, extensions, jogs, and relative segment lengths.
3. Every connected wall corner or intersection must be one shared node referenced by each adjoining wall. Do not duplicate coincident corner nodes.
4. Classify walls as exterior, interior, or unknown. Do not straighten visibly angled walls or turn a recess into a rectangle.
5. Detect doors, windows, and open passages. Anchor every opening to one wall using position_ratio from 0 to 1 at its center and width_ratio relative to that wall.
6. Detect stairs as an outline polygon, direction when visible, and step count when countable.
7. Preserve room labels only when legible or strongly implied. Never invent a room label from furniture alone.

REFERENCE SCALE RULES
1. Read all written dimensions, but select exactly one clearest dimension that is tied to a specific wall segment as reference_measurement.
2. Prefer an unambiguous dimension such as 24 inches or 1 foot over unclear handwriting. Preserve its exact value and unit.
3. Do not use multiple dimensions to distort different portions of the sketch. All other lengths will be derived proportionally from this one reference and the traced geometry.
4. If no dimension is sufficiently legible or cannot be tied to one returned wall, return reference_measurement as null. Never guess a written value.

Return exactly this JSON shape:
{{
  "coordinate_system": {{"width": {coordinate_width}, "height": {coordinate_height}}},
  "nodes": [{{"id": "n1", "x": 100, "y": 100, "confidence": 0.95}}],
  "walls": [{{"id": "w1", "start_node_id": "n1", "end_node_id": "n2", "kind": "exterior", "confidence": 0.95}}],
  "openings": [{{"id": "d1", "type": "door", "wall_id": "w1", "position_ratio": 0.5, "width_ratio": 0.15, "hinge": "start", "swing_side": "left", "label": "", "confidence": 0.85}}],
  "stairs": [{{"id": "s1", "points": [{{"x": 100, "y": 100}}, {{"x": 220, "y": 100}}, {{"x": 220, "y": 300}}, {{"x": 100, "y": 300}}], "direction": "up", "step_count": 10, "confidence": 0.8}}],
  "rooms": [{{"id": "r1", "label": "Kitchen", "x": 300, "y": 300, "confidence": 0.8}}],
  "reference_measurement": {{"wall_id": "w1", "value": 24, "unit": "in", "source_text": "24\"", "confidence": 0.9}},
  "uncertainty_notes": ["Short factual uncertainty"]
}}

Allowed opening types: door, window, opening. Allowed hinge values: start, end, unknown. Allowed swing_side values: left, right, unknown.
Return every array even when empty. Use reference_measurement null when unavailable. Return JSON only, without markdown.
""".strip()
    return system_prompt, user_prompt


def normalize_plan_geometry(payload):
    if not isinstance(payload, dict):
        raise ValueError("The floor-plan analysis did not return an object.")
    source = payload.get("plan_geometry") if isinstance(payload.get("plan_geometry"), dict) else payload
    coordinate_system = source.get("coordinate_system") if isinstance(source.get("coordinate_system"), dict) else {}
    source_width = _number(coordinate_system.get("width"), 1000, 100, 10000)
    source_height = _number(coordinate_system.get("height"), 1000, 100, 10000)

    raw_nodes = source.get("nodes") if isinstance(source.get("nodes"), list) else []
    nodes = []
    node_ids = set()
    node_aliases = {}
    merged_node_count = 0
    merge_tolerance = max(2, min(source_width, source_height) * 0.006)
    for index, raw in enumerate(raw_nodes[:300]):
        if not isinstance(raw, dict):
            continue
        raw_node_id = _clean_id(raw.get("id"), "n", index)
        x = _number(raw.get("x"), 0, 0, source_width)
        y = _number(raw.get("y"), 0, 0, source_height)
        existing = next(
            (
                node
                for node in nodes
                if math.hypot(node["source_x"] - x, node["source_y"] - y) <= merge_tolerance
            ),
            None,
        )
        if existing:
            node_aliases[raw_node_id] = existing["id"]
            existing["confidence"] = max(existing["confidence"], _confidence(raw.get("confidence")))
            merged_node_count += 1
            continue
        node_id = raw_node_id
        if node_id in node_ids:
            node_id = f"{node_id}-{index + 1}"
        node_ids.add(node_id)
        node_aliases.setdefault(raw_node_id, node_id)
        nodes.append(
            {
                "id": node_id,
                "source_x": x,
                "source_y": y,
                "confidence": _confidence(raw.get("confidence")),
            }
        )
    node_by_id = {node["id"]: node for node in nodes}

    raw_walls = source.get("walls") if isinstance(source.get("walls"), list) else []
    walls = []
    wall_ids = set()
    for index, raw in enumerate(raw_walls[:300]):
        if not isinstance(raw, dict):
            continue
        raw_start_id = _clean_text(raw.get("start_node_id"), 64)
        raw_end_id = _clean_text(raw.get("end_node_id"), 64)
        start_id = node_aliases.get(raw_start_id, raw_start_id)
        end_id = node_aliases.get(raw_end_id, raw_end_id)
        if start_id == end_id or start_id not in node_by_id or end_id not in node_by_id:
            continue
        start = node_by_id[start_id]
        end = node_by_id[end_id]
        if math.hypot(end["source_x"] - start["source_x"], end["source_y"] - start["source_y"]) < 2:
            continue
        wall_id = _clean_id(raw.get("id"), "w", index)
        if wall_id in wall_ids:
            wall_id = f"{wall_id}-{index + 1}"
        wall_ids.add(wall_id)
        kind = str(raw.get("kind") or "unknown").strip().lower()
        walls.append(
            {
                "id": wall_id,
                "start_node_id": start_id,
                "end_node_id": end_id,
                "kind": kind if kind in {"exterior", "interior", "unknown"} else "unknown",
                "confidence": _confidence(raw.get("confidence")),
            }
        )
    if not walls:
        raise ValueError("No connected wall geometry could be detected in this sketch.")

    used_node_ids = {wall["start_node_id"] for wall in walls} | {wall["end_node_id"] for wall in walls}
    nodes = [node for node in nodes if node["id"] in used_node_ids]
    node_by_id = {node["id"]: node for node in nodes}

    min_x = min(node["source_x"] for node in nodes)
    max_x = max(node["source_x"] for node in nodes)
    min_y = min(node["source_y"] for node in nodes)
    max_y = max(node["source_y"] for node in nodes)
    extent_width = max(1, max_x - min_x)
    extent_height = max(1, max_y - min_y)
    drawable_width = PLAN_CANVAS_WIDTH - (PLAN_MARGIN * 2)
    drawable_height = PLAN_CANVAS_HEIGHT - (PLAN_MARGIN * 2)
    scale = min(drawable_width / extent_width, drawable_height / extent_height)
    offset_x = (PLAN_CANVAS_WIDTH - extent_width * scale) / 2
    offset_y = (PLAN_CANVAS_HEIGHT - extent_height * scale) / 2

    for node in nodes:
        node["x"] = round(offset_x + (node.pop("source_x") - min_x) * scale, 2)
        node["y"] = round(offset_y + (node.pop("source_y") - min_y) * scale, 2)

    for wall in walls:
        start = node_by_id[wall["start_node_id"]]
        end = node_by_id[wall["end_node_id"]]
        pixel_length = math.hypot(end["x"] - start["x"], end["y"] - start["y"])
        wall["pixel_length"] = round(pixel_length, 3)
        wall["angle_degrees"] = round(math.degrees(math.atan2(end["y"] - start["y"], end["x"] - start["x"])), 2)
        wall["thickness_px"] = 14 if wall["kind"] == "exterior" else 10
    wall_by_id = {wall["id"]: wall for wall in walls}

    raw_reference = source.get("reference_measurement")
    reference = None
    if isinstance(raw_reference, dict):
        wall_id = _clean_text(raw_reference.get("wall_id"), 64)
        unit = _canonical_unit(raw_reference.get("unit"))
        value = _number(raw_reference.get("value"), 0, 0)
        value_inches = _unit_to_inches(value, unit)
        if wall_id in wall_by_id and value_inches > 0:
            reference = {
                "wall_id": wall_id,
                "value": round(value, 4),
                "unit": unit,
                "value_inches": round(value_inches, 4),
                "source_text": _clean_text(raw_reference.get("source_text"), 40) or f"{value:g} {unit}",
                "confidence": _confidence(raw_reference.get("confidence"), 0.7),
                "estimated": False,
            }
    if reference is None:
        fallback_wall = max(
            walls,
            key=lambda wall: (wall["kind"] == "exterior", wall["pixel_length"]),
        )
        reference = {
            "wall_id": fallback_wall["id"],
            "value": 1,
            "unit": "ft",
            "value_inches": FALLBACK_REFERENCE_INCHES,
            "source_text": "1 ft proportional reference",
            "confidence": 0,
            "estimated": True,
        }

    reference_wall = wall_by_id[reference["wall_id"]]
    pixels_per_inch = reference_wall["pixel_length"] / reference["value_inches"]
    reference["pixel_length"] = reference_wall["pixel_length"]
    reference["pixels_per_inch"] = round(pixels_per_inch, 6)
    for wall in walls:
        wall["length_inches"] = round(wall["pixel_length"] / pixels_per_inch, 3)

    raw_openings = source.get("openings") if isinstance(source.get("openings"), list) else []
    openings = []
    opening_ids = set()
    for index, raw in enumerate(raw_openings[:200]):
        if not isinstance(raw, dict):
            continue
        wall_id = _clean_text(raw.get("wall_id"), 64)
        if wall_id not in wall_by_id:
            continue
        opening_type = str(raw.get("type") or "opening").strip().lower()
        if opening_type not in {"door", "window", "opening"}:
            opening_type = "opening"
        opening_id = _clean_id(raw.get("id"), "o", index)
        if opening_id in opening_ids:
            opening_id = f"{opening_id}-{index + 1}"
        opening_ids.add(opening_id)
        position = _number(raw.get("position_ratio", raw.get("position")), 0.5, 0.02, 0.98)
        width_ratio = _number(raw.get("width_ratio"), 0.12, 0.02, 0.8)
        width_ratio = min(width_ratio, position * 2, (1 - position) * 2)
        hinge = str(raw.get("hinge") or "unknown").strip().lower()
        swing_side = str(raw.get("swing_side") or "unknown").strip().lower()
        wall = wall_by_id[wall_id]
        openings.append(
            {
                "id": opening_id,
                "type": opening_type,
                "wall_id": wall_id,
                "position_ratio": round(position, 5),
                "width_ratio": round(width_ratio, 5),
                "width_inches": round(wall["length_inches"] * width_ratio, 3),
                "hinge": hinge if hinge in {"start", "end", "unknown"} else "unknown",
                "swing_side": swing_side if swing_side in {"left", "right", "unknown"} else "unknown",
                "label": _clean_text(raw.get("label"), 60),
                "confidence": _confidence(raw.get("confidence")),
            }
        )

    def transform_point(raw_point):
        return {
            "x": round(offset_x + (_number(raw_point.get("x"), min_x, 0, source_width) - min_x) * scale, 2),
            "y": round(offset_y + (_number(raw_point.get("y"), min_y, 0, source_height) - min_y) * scale, 2),
        }

    raw_stairs = source.get("stairs") if isinstance(source.get("stairs"), list) else []
    stairs = []
    for index, raw in enumerate(raw_stairs[:40]):
        if not isinstance(raw, dict):
            continue
        raw_points = raw.get("points") if isinstance(raw.get("points"), list) else []
        points = [transform_point(point) for point in raw_points[:12] if isinstance(point, dict)]
        if len(points) < 3:
            continue
        direction = str(raw.get("direction") or "unknown").strip().lower()
        stairs.append(
            {
                "id": _clean_id(raw.get("id"), "s", index),
                "points": points,
                "direction": direction if direction in {"up", "down", "unknown"} else "unknown",
                "step_count": int(_number(raw.get("step_count"), 0, 0, 40)),
                "confidence": _confidence(raw.get("confidence")),
            }
        )

    raw_rooms = source.get("rooms") if isinstance(source.get("rooms"), list) else []
    rooms = []
    for index, raw in enumerate(raw_rooms[:80]):
        if not isinstance(raw, dict) or not _clean_text(raw.get("label"), 60):
            continue
        point = transform_point(raw)
        rooms.append(
            {
                "id": _clean_id(raw.get("id"), "r", index),
                "label": _clean_text(raw.get("label"), 60),
                **point,
                "confidence": _confidence(raw.get("confidence")),
            }
        )

    uncertainty_notes = []
    for note in source.get("uncertainty_notes") if isinstance(source.get("uncertainty_notes"), list) else []:
        cleaned = _clean_text(note, 180)
        if cleaned and cleaned not in uncertainty_notes:
            uncertainty_notes.append(cleaned)
        if len(uncertainty_notes) >= 12:
            break
    if reference["estimated"]:
        uncertainty_notes.insert(0, "No legible dimension was tied to a wall; a 1 ft proportional reference was applied.")

    low_confidence_count = sum(1 for item in [*walls, *openings, *stairs] if item["confidence"] < 0.6)
    return {
        "schema_version": 1,
        "canvas": {"width": PLAN_CANVAS_WIDTH, "height": PLAN_CANVAS_HEIGHT, "unit": "px"},
        "nodes": nodes,
        "walls": walls,
        "openings": openings,
        "stairs": stairs,
        "rooms": rooms,
        "reference_measurement": reference,
        "uncertainty_notes": uncertainty_notes,
        "review_required": bool(reference["estimated"] or low_confidence_count),
        "semantic_summary": {
            "wall_count": len(walls),
            "door_count": sum(1 for opening in openings if opening["type"] == "door"),
            "window_count": sum(1 for opening in openings if opening["type"] == "window"),
            "opening_count": sum(1 for opening in openings if opening["type"] == "opening"),
            "stair_count": len(stairs),
            "room_count": len(rooms),
            "low_confidence_count": low_confidence_count,
            "merged_corner_count": merged_node_count,
        },
    }


def measurement_calibration_from_geometry(geometry):
    reference = geometry.get("reference_measurement") if isinstance(geometry, dict) else {}
    if not isinstance(reference, dict) or _number(reference.get("pixels_per_inch"), 0) <= 0:
        return {}
    display_unit = reference.get("unit") if reference.get("unit") in {"in", "ft", "cm", "mm", "m"} else "in"
    return {
        "length": reference.get("value", 1),
        "unit": display_unit,
        "scale": round(reference["pixel_length"] / _number(reference.get("value"), 1, 0.0001), 6),
        "referencePx": reference["pixel_length"],
        "referenceLineId": f"plan-reference-{reference.get('wall_id', '')}",
        "source": "plan_geometry",
        "estimated": bool(reference.get("estimated")),
    }


def _font(size, bold=False):
    candidates = [
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _point_on_wall(start, end, ratio):
    return (
        start[0] + (end[0] - start[0]) * ratio,
        start[1] + (end[1] - start[1]) * ratio,
    )


def _draw_door(draw, start, end, opening):
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = math.hypot(dx, dy)
    if length <= 0:
        return
    ux, uy = dx / length, dy / length
    nx, ny = -uy, ux
    center = opening["position_ratio"]
    half = opening["width_ratio"] / 2
    open_start = _point_on_wall(start, end, center - half)
    open_end = _point_on_wall(start, end, center + half)
    hinge_at_end = opening.get("hinge") == "end"
    hinge = open_end if hinge_at_end else open_start
    gap = math.hypot(open_end[0] - open_start[0], open_end[1] - open_start[1])
    closed_angle = math.atan2(-uy if hinge_at_end else uy, -ux if hinge_at_end else ux)
    side = -1 if opening.get("swing_side") == "right" else 1
    open_angle = math.atan2(ny * side, nx * side)
    delta = (open_angle - closed_angle + math.pi) % (2 * math.pi) - math.pi
    leaf_end = (hinge[0] + math.cos(open_angle) * gap, hinge[1] + math.sin(open_angle) * gap)
    draw.line([hinge, leaf_end], fill="#111827", width=3)
    arc_points = []
    for step in range(17):
        angle = closed_angle + delta * (step / 16)
        arc_points.append((hinge[0] + math.cos(angle) * gap, hinge[1] + math.sin(angle) * gap))
    draw.line(arc_points, fill="#64748b", width=2)


def _draw_stairs(draw, stair):
    points = [(point["x"], point["y"]) for point in stair["points"]]
    draw.line(points + [points[0]], fill="#334155", width=3, joint="curve")
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    left, right, top, bottom = min(xs), max(xs), min(ys), max(ys)
    count = stair.get("step_count") or 8
    count = max(3, min(16, count))
    horizontal = (right - left) >= (bottom - top)
    for index in range(1, count):
        ratio = index / count
        if horizontal:
            x = left + (right - left) * ratio
            draw.line([(x, top), (x, bottom)], fill="#64748b", width=2)
        else:
            y = top + (bottom - top) * ratio
            draw.line([(left, y), (right, y)], fill="#64748b", width=2)
    direction = stair.get("direction")
    if direction in {"up", "down"}:
        draw.text((left + 6, top + 6), direction.upper(), fill="#334155", font=_font(13, bold=True))


def render_plan_geometry_png(geometry):
    image = Image.new("RGB", (PLAN_CANVAS_WIDTH, PLAN_CANVAS_HEIGHT), "white")
    draw = ImageDraw.Draw(image)
    nodes = {node["id"]: node for node in geometry["nodes"]}
    openings_by_wall = {}
    for opening in geometry["openings"]:
        openings_by_wall.setdefault(opening["wall_id"], []).append(opening)

    for wall in geometry["walls"]:
        start_node = nodes[wall["start_node_id"]]
        end_node = nodes[wall["end_node_id"]]
        start = (start_node["x"], start_node["y"])
        end = (end_node["x"], end_node["y"])
        intervals = []
        for opening in openings_by_wall.get(wall["id"], []):
            half = opening["width_ratio"] / 2
            intervals.append((max(0, opening["position_ratio"] - half), min(1, opening["position_ratio"] + half)))
        intervals.sort()
        cursor = 0
        for interval_start, interval_end in intervals:
            if interval_start > cursor:
                draw.line(
                    [_point_on_wall(start, end, cursor), _point_on_wall(start, end, interval_start)],
                    fill="#111111",
                    width=wall["thickness_px"],
                )
            cursor = max(cursor, interval_end)
        if cursor < 1:
            draw.line(
                [_point_on_wall(start, end, cursor), end],
                fill="#111111",
                width=wall["thickness_px"],
            )

    node_widths = {}
    for wall in geometry["walls"]:
        node_widths[wall["start_node_id"]] = max(node_widths.get(wall["start_node_id"], 0), wall["thickness_px"])
        node_widths[wall["end_node_id"]] = max(node_widths.get(wall["end_node_id"], 0), wall["thickness_px"])
    for node_id, width in node_widths.items():
        node = nodes[node_id]
        radius = width / 2
        draw.ellipse((node["x"] - radius, node["y"] - radius, node["x"] + radius, node["y"] + radius), fill="#111111")

    for opening in geometry["openings"]:
        wall = next(item for item in geometry["walls"] if item["id"] == opening["wall_id"])
        start_node = nodes[wall["start_node_id"]]
        end_node = nodes[wall["end_node_id"]]
        start = (start_node["x"], start_node["y"])
        end = (end_node["x"], end_node["y"])
        half = opening["width_ratio"] / 2
        open_start = _point_on_wall(start, end, opening["position_ratio"] - half)
        open_end = _point_on_wall(start, end, opening["position_ratio"] + half)
        draw.line([open_start, open_end], fill="white", width=wall["thickness_px"] + 4)
        if opening["type"] == "window":
            dx, dy = end[0] - start[0], end[1] - start[1]
            length = math.hypot(dx, dy) or 1
            nx, ny = -dy / length, dx / length
            for offset in (-3, 3):
                draw.line(
                    [(open_start[0] + nx * offset, open_start[1] + ny * offset), (open_end[0] + nx * offset, open_end[1] + ny * offset)],
                    fill="#334155",
                    width=2,
                )
            draw.line([open_start, open_end], fill="#64748b", width=1)
        elif opening["type"] == "door":
            _draw_door(draw, start, end, opening)

    for stair in geometry["stairs"]:
        _draw_stairs(draw, stair)

    room_font = _font(16, bold=True)
    for room in geometry["rooms"]:
        label = room["label"].upper()
        bbox = draw.textbbox((0, 0), label, font=room_font)
        draw.text((room["x"] - (bbox[2] - bbox[0]) / 2, room["y"] - (bbox[3] - bbox[1]) / 2), label, fill="#475569", font=room_font)

    reference = geometry["reference_measurement"]
    wall = next(item for item in geometry["walls"] if item["id"] == reference["wall_id"])
    start_node = nodes[wall["start_node_id"]]
    end_node = nodes[wall["end_node_id"]]
    start = (start_node["x"], start_node["y"])
    end = (end_node["x"], end_node["y"])
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = math.hypot(dx, dy) or 1
    nx, ny = -dy / length, dx / length
    center_x = sum(node["x"] for node in geometry["nodes"]) / len(geometry["nodes"])
    center_y = sum(node["y"] for node in geometry["nodes"]) / len(geometry["nodes"])
    midpoint = ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
    if (midpoint[0] - center_x) * nx + (midpoint[1] - center_y) * ny < 0:
        nx, ny = -nx, -ny
    offset = 28
    dim_start = (start[0] + nx * offset, start[1] + ny * offset)
    dim_end = (end[0] + nx * offset, end[1] + ny * offset)
    draw.line([start, dim_start], fill="#94a3b8", width=1)
    draw.line([end, dim_end], fill="#94a3b8", width=1)
    draw.line([dim_start, dim_end], fill="#475569", width=2)
    tick = 5
    draw.line([(dim_start[0] - nx * tick, dim_start[1] - ny * tick), (dim_start[0] + nx * tick, dim_start[1] + ny * tick)], fill="#475569", width=2)
    draw.line([(dim_end[0] - nx * tick, dim_end[1] - ny * tick), (dim_end[0] + nx * tick, dim_end[1] + ny * tick)], fill="#475569", width=2)
    prefix = "EST. REFERENCE" if reference["estimated"] else "REFERENCE"
    label = f"{prefix}: {reference['source_text']}"
    label_font = _font(14, bold=True)
    label_box = draw.textbbox((0, 0), label, font=label_font)
    label_x = (dim_start[0] + dim_end[0]) / 2 - (label_box[2] - label_box[0]) / 2
    label_y = (dim_start[1] + dim_end[1]) / 2 - (label_box[3] - label_box[1]) / 2 - 4
    draw.rectangle((label_x - 5, label_y - 3, label_x + (label_box[2] - label_box[0]) + 5, label_y + (label_box[3] - label_box[1]) + 3), fill="white")
    draw.text((label_x, label_y), label, fill="#334155", font=label_font)

    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
