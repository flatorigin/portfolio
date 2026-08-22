from io import BytesIO
from unittest.mock import patch

from django.test import SimpleTestCase
from PIL import Image

from .floor_plan import (
    apply_dimension_overrides,
    measurement_calibration_from_geometry,
    normalize_plan_geometry,
    parse_length_to_inches,
    render_plan_geometry_png,
)


class FloorPlanGeometryTests(SimpleTestCase):
    def payload(self, reference=None):
        return {
            "coordinate_system": {"width": 1000, "height": 800},
            "nodes": [
                {"id": "n1", "x": 100, "y": 100, "confidence": 0.9},
                {"id": "n2", "x": 800, "y": 100, "confidence": 0.9},
                {"id": "n3", "x": 900, "y": 400, "confidence": 0.9},
                {"id": "n4a", "x": 650, "y": 650, "confidence": 0.9},
                {"id": "n4b", "x": 653, "y": 652, "confidence": 0.8},
                {"id": "n5", "x": 400, "y": 500, "confidence": 0.9},
                {"id": "n6", "x": 100, "y": 650, "confidence": 0.9},
            ],
            "walls": [
                {"id": "w1", "start_node_id": "n1", "end_node_id": "n2", "kind": "exterior", "confidence": 0.9},
                {"id": "w2", "start_node_id": "n2", "end_node_id": "n3", "kind": "exterior", "confidence": 0.9},
                {"id": "w3", "start_node_id": "n3", "end_node_id": "n4a", "kind": "exterior", "confidence": 0.9},
                {"id": "w4", "start_node_id": "n4b", "end_node_id": "n5", "kind": "exterior", "confidence": 0.9},
                {"id": "w5", "start_node_id": "n5", "end_node_id": "n6", "kind": "exterior", "confidence": 0.9},
                {"id": "w6", "start_node_id": "n6", "end_node_id": "n1", "kind": "exterior", "confidence": 0.9},
            ],
            "openings": [
                {"id": "d1", "type": "door", "wall_id": "w1", "position_ratio": 0.25, "width_ratio": 0.1, "hinge": "start", "swing_side": "left", "confidence": 0.8},
                {"id": "win1", "type": "window", "wall_id": "w2", "position_ratio": 0.5, "width_ratio": 0.2, "hinge": "unknown", "swing_side": "unknown", "confidence": 0.8},
            ],
            "stairs": [
                {"id": "s1", "points": [{"x": 200, "y": 200}, {"x": 350, "y": 200}, {"x": 350, "y": 400}, {"x": 200, "y": 400}], "direction": "up", "step_count": 8, "confidence": 0.8}
            ],
            "rooms": [{"id": "r1", "label": "Living", "x": 500, "y": 300, "confidence": 0.8}],
            "dimensions": [
                {
                    "id": "dim-clear",
                    "x1": 100,
                    "y1": 100,
                    "x2": 800,
                    "y2": 100,
                    "value": 24,
                    "unit": "in",
                    "source_text": '24"',
                    "kind": "wall_segment",
                    "clarity": "clear",
                    "confidence": 0.95,
                },
                {
                    "id": "dim-unclear",
                    "x1": 800,
                    "y1": 100,
                    "x2": 900,
                    "y2": 400,
                    "value": None,
                    "unit": "in",
                    "source_text": '3?"',
                    "kind": "opening",
                    "clarity": "unclear",
                    "confidence": 0.35,
                },
            ],
            "reference_measurement": reference,
            "uncertainty_notes": [],
        }

    def test_mixed_feet_and_inches_are_parsed(self):
        self.assertEqual(parse_length_to_inches("24'3\"", "ft"), 291)

    def test_reference_scales_every_wall_proportionally_and_preserves_angles(self):
        geometry = normalize_plan_geometry(
            self.payload({"wall_id": "w1", "value": 24, "unit": "in", "source_text": "24\"", "confidence": 0.95})
        )

        walls = {wall["id"]: wall for wall in geometry["walls"]}
        self.assertAlmostEqual(walls["w1"]["length_inches"], 24, places=2)
        expected_ratio = walls["w2"]["pixel_length"] / walls["w1"]["pixel_length"]
        self.assertAlmostEqual(walls["w2"]["length_inches"], 24 * expected_ratio, places=2)
        self.assertNotEqual(walls["w2"]["angle_degrees"], 90)
        self.assertEqual(walls["w3"]["end_node_id"], walls["w4"]["start_node_id"])
        self.assertEqual(geometry["semantic_summary"]["merged_corner_count"], 1)
        self.assertEqual(geometry["openings"][0]["wall_id"], "w1")
        self.assertEqual(geometry["semantic_summary"]["stair_count"], 1)

    def test_missing_dimension_uses_explicit_estimated_reference(self):
        geometry = normalize_plan_geometry(self.payload(reference=None))

        self.assertTrue(geometry["reference_measurement"]["estimated"])
        self.assertEqual(geometry["reference_measurement"]["value"], 1)
        self.assertEqual(geometry["reference_measurement"]["unit"], "ft")
        self.assertTrue(geometry["review_required"])
        self.assertIn("1 ft proportional reference", geometry["reference_measurement"]["source_text"])

    def test_gross_dimensions_define_plan_and_workspace_with_two_feet_per_side(self):
        geometry = normalize_plan_geometry(
            self.payload({"wall_id": "w1", "value": 24, "unit": "in", "source_text": '24"'}),
            gross_width="24'3\"",
            gross_length="30",
            gross_unit="ft",
        )

        self.assertEqual(geometry["plan_bounds"]["width_inches"], 291)
        self.assertEqual(geometry["plan_bounds"]["length_inches"], 360)
        self.assertEqual(geometry["workspace"]["margin_inches_each_side"], 24)
        self.assertEqual(geometry["workspace"]["width_inches"], 339)
        self.assertEqual(geometry["workspace"]["length_inches"], 408)
        self.assertEqual(geometry["reference_measurement"]["dimension_id"], "gross-width")
        self.assertEqual(geometry["reference_measurement"]["value"], 24.25)
        self.assertEqual(geometry["semantic_summary"]["clear_dimension_count"], 3)
        self.assertEqual(geometry["semantic_summary"]["unclear_dimension_count"], 1)

    def test_unclear_dimension_can_be_entered_without_changing_clear_dimensions(self):
        geometry = normalize_plan_geometry(
            self.payload(),
            gross_width="24",
            gross_length="30",
            gross_unit="ft",
        )
        clear_before = next(item for item in geometry["dimensions"] if item["id"] == "dim-clear")

        updated, applied = apply_dimension_overrides(
            geometry,
            {
                "dim-clear": {"value": "30", "unit": "in"},
                "dim-unclear": {"value": "36", "unit": "in"},
            },
        )

        clear_after = next(item for item in updated["dimensions"] if item["id"] == "dim-clear")
        corrected = next(item for item in updated["dimensions"] if item["id"] == "dim-unclear")
        self.assertEqual(applied, 1)
        self.assertEqual(clear_after["value_inches"], clear_before["value_inches"])
        self.assertEqual(corrected["value_inches"], 36)
        self.assertEqual(corrected["clarity"], "user_entered")
        self.assertEqual(updated["semantic_summary"]["unclear_dimension_count"], 0)

    def test_renderer_outputs_canvas_png_and_calibration(self):
        geometry = normalize_plan_geometry(
            self.payload({"wall_id": "w1", "value": 2, "unit": "ft", "source_text": "2 ft", "confidence": 0.95})
        )
        rendered = render_plan_geometry_png(geometry)
        calibration = measurement_calibration_from_geometry(geometry)

        with Image.open(BytesIO(rendered)) as image:
            self.assertEqual(image.format, "PNG")
            self.assertEqual(image.size, (1200, 760))
        self.assertEqual(calibration["length"], 2)
        self.assertEqual(calibration["unit"], "ft")
        self.assertGreater(calibration["scale"], 0)

    @patch("portfolio.floor_plan._draw_dimension")
    def test_renderer_prints_every_clear_dimension(self, mock_draw_dimension):
        geometry = normalize_plan_geometry(
            self.payload(),
            gross_width="24",
            gross_length="30",
            gross_unit="ft",
        )

        render_plan_geometry_png(geometry)

        self.assertEqual(mock_draw_dimension.call_count, 3)
