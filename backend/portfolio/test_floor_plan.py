from io import BytesIO

from django.test import SimpleTestCase
from PIL import Image

from .floor_plan import (
    measurement_calibration_from_geometry,
    normalize_plan_geometry,
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
            "reference_measurement": reference,
            "uncertainty_notes": [],
        }

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
