from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from .siding_estimators import calculate_siding_estimate


class SidingCalculationTests(SimpleTestCase):
    def calculate(self, section, **pricing):
        return calculate_siding_estimate({'sections': [section], **pricing})[1]

    def test_rectangle_openings_waste_and_labor(self):
        result = self.calculate({'measurement': 'rectangle', 'width': 30, 'height': 10, 'openings': 40,
                                 'material_rate': 2, 'labor_rate': 3})
        self.assertEqual(result['sections'][0]['area'], '260')
        self.assertEqual(result['sections'][0]['purchase_area'], '286')
        self.assertEqual(result['final_price'], '1352.00')

    def test_net_area_does_not_deduct_openings_twice(self):
        result = self.calculate({'measurement': 'net', 'area': 260, 'openings': 1000, 'labor_rate': 3})
        self.assertEqual(result['sections'][0]['openings'], '0')
        self.assertEqual(result['final_price'], '780.00')

    def test_gable_uses_rise_not_full_building_height(self):
        result = self.calculate({'measurement': 'triangle', 'width': 30, 'height': 8, 'openings': 20})
        self.assertEqual(result['sections'][0]['measured_area'], '120')
        self.assertEqual(result['sections'][0]['area'], '100')

    def test_square_unit_matches_square_foot_rate(self):
        sq = self.calculate({'area': 300, 'pricing': 'square', 'material_rate': 200})
        sqft = self.calculate({'area': 300, 'material_rate': 2})
        self.assertEqual(sq['final_price'], sqft['final_price'])
        self.assertEqual(sq['sections'][0]['squares'], '3.3')

    def test_customer_siding_preserves_labor_removal_and_extras(self):
        result = self.calculate({'area': 100, 'material_rate': 50, 'material_supplier': 'client', 'labor_rate': 2,
                                 'remove_existing': True, 'removal_override': True, 'removal_area': 50, 'removal_rate': 1,
                                 'preparation': 80, 'disposal': 20,
                                 'extras': [{'name': 'Trim', 'unit': 'linear ft', 'quantity': 40, 'rate': 5}]})
        self.assertEqual(result['final_price'], '550.00')
        self.assertEqual(result['sections'][0]['line_items'][0]['amount'], '0.00')

    def test_zero_area_and_disabled_removal(self):
        self.assertEqual(self.calculate({'area': 10, 'openings': 10, 'material_rate': 50, 'labor_rate': 5,
                                          'removal_override': True, 'removal_area': 50, 'removal_rate': 10})['final_price'], '0.00')

    def test_multiple_sections_and_pricing(self):
        _, result = calculate_siding_estimate({'sections': [{'area': 100, 'labor_rate': 2}, {'area': 200, 'labor_rate': 1}], 'profit_method': 'margin', 'profit': 20, 'discount': 10})
        self.assertEqual(result['final_price'], '450.00')

    def test_invalid_inputs(self):
        for section in ({'area': -1}, {'area': 'NaN'}, {'area': 10, 'openings': 11}, {'waste': 101},
                        {'measurement': 'bad'}, {'pricing': 'bad'}, {'material': ''}, {'remove_existing': 'yes'},
                        {'measurement': 'rectangle', 'width': 1000000, 'height': 1000000},
                        {'area': 100, 'remove_existing': True, 'removal_override': True, 'removal_area': 101},
                        {'extras': [{'unit': 'unknown'}]}, {'area': 1000000, 'material_rate': 1000000}):
            with self.subTest(section=section), self.assertRaises(ValidationError):
                self.calculate(section)


class SidingApiTests(APITestCase):
    def test_preview_save_reopen_update_and_owner_isolation(self):
        inputs = {'sections': [{'name': 'Front', 'material': 'Custom siding', 'product_name': 'Smooth finish',
                                'area': 300, 'openings': 40, 'material_rate': 2, 'labor_rate': 3}]}
        preview = self.client.post('/api/estimates/siding_preview/', inputs, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(self.client.post('/api/estimates/', {'estimate_type': 'siding', 'project_name': 'Exterior', 'inputs': inputs}, format='json').status_code, 401)
        self.client.force_authenticate(get_user_model().objects.create_user(username='siding-owner'))
        saved = self.client.post('/api/estimates/', {'estimate_type': 'siding', 'project_name': 'Exterior', 'inputs': inputs, 'final_price': '1.00'}, format='json')
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data['final_price'], '1352.00')
        url = f"/api/estimates/{saved.data['id']}/"
        self.assertEqual(self.client.get(url).data['inputs']['sections'][0]['material'], 'Custom siding')
        inputs['sections'][0]['area'] = 200
        self.assertEqual(self.client.patch(url, {'inputs': inputs}, format='json').data['final_price'], '832.00')
        self.client.force_authenticate(get_user_model().objects.create_user(username='siding-other'))
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, {'project_name': 'Other'}, format='json').status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
