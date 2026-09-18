from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from .roofing_estimators import calculate_roofing_estimate


class RoofingCalculationTests(SimpleTestCase):
    def calculate(self, section, **pricing):
        return calculate_roofing_estimate({'sections': [section], **pricing})[1]

    def test_actual_area_does_not_get_pitch_twice(self):
        result = self.calculate({'area': 1000, 'pitch': 12, 'material_rate': 2, 'labor_rate': 3})
        self.assertEqual(result['sections'][0]['area'], '1000')
        self.assertEqual(result['sections'][0]['purchase_area'], '1100')
        self.assertEqual(result['final_price'], '5200.00')

    def test_footprint_pitch_and_flat_roof(self):
        result = self.calculate({'measurement': 'footprint', 'area': 1000, 'pitch': 9.0, 'labor_rate': 1})
        self.assertEqual(result['sections'][0]['area'], '1250')
        self.assertEqual(result['sections'][0]['roofing_squares'], '12.5')
        self.assertEqual(result['final_price'], '1250.00')
        self.assertEqual(self.calculate({'measurement': 'footprint', 'area': 1000, 'pitch': 0})['sections'][0]['area'], '1000')

    def test_customer_covering_tearoff_extras_and_disposal(self):
        result = self.calculate({'area': 1000, 'material_rate': 2, 'material_supplier': 'client',
                                 'labor_rate': 3, 'tearoff_layers': 2, 'tearoff_rate': 0.5, 'disposal': 200,
                                 'extras': [{'name': 'Ridge caps', 'quantity': 40, 'rate': 5, 'unit': 'linear ft'}]})
        self.assertEqual(result['final_price'], '4400.00')
        self.assertTrue(result['sections'][0]['line_items'][0]['customer_supplied'])

    def test_multiple_sections_and_pricing(self):
        _, result = calculate_roofing_estimate({'sections': [{'area': 100, 'labor_rate': 2}, {'area': 200, 'labor_rate': 1}], 'profit_method': 'margin', 'profit': 20, 'discount': 10})
        self.assertEqual(result['final_price'], '450.00')

    def test_invalid_and_overflow_inputs(self):
        for section in ({'area': -1}, {'pitch': 'NaN'}, {'pitch': 25}, {'tearoff_layers': 1.5},
                        {'measurement': 'unknown'}, {'material_supplier': False}, {'extras': 'bad'},
                        {'extras': [{'name': '', 'quantity': 2}]}, {'area': 1000000, 'material_rate': 1000000}):
            with self.subTest(section=section), self.assertRaises(ValidationError):
                self.calculate(section)


class RoofingApiTests(APITestCase):
    def test_preview_save_reopen_update_and_private_access(self):
        inputs = {'sections': [{'area': 1000, 'material_rate': 2, 'labor_rate': 3}]}
        preview = self.client.post('/api/estimates/roofing_preview/', inputs, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        self.client.force_authenticate(get_user_model().objects.create_user(username='roof-owner'))
        saved = self.client.post('/api/estimates/', {'estimate_type': 'roofing', 'project_name': 'Roof', 'inputs': inputs, 'final_price': '1.00'}, format='json')
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data['final_price'], preview.data['final_price'])
        url = f"/api/estimates/{saved.data['id']}/"
        self.assertEqual(self.client.get(url).data['estimate_type'], 'roofing')
        inputs['sections'][0]['area'] = 2000
        updated = self.client.patch(url, {'inputs': inputs}, format='json')
        self.assertEqual(updated.data['final_price'], '10400.00')
        self.client.force_authenticate(get_user_model().objects.create_user(username='roof-other'))
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, {'project_name': 'Other'}, format='json').status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
