from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from .decking_estimators import calculate_decking_estimate


class DeckingCalculationTests(SimpleTestCase):
    def calculate(self, section, **pricing):
        return calculate_decking_estimate({'sections': [section], **pricing})[1]

    def test_waste_only_applies_to_boards(self):
        result = self.calculate({'measurement': 'dimensions', 'length': 20, 'width': 10, 'material_rate': 4,
                                 'labor_rate': 3, 'include_framing': True, 'framing_rate': 10})
        self.assertEqual(result['sections'][0]['area'], '200')
        self.assertEqual(result['sections'][0]['purchase_area'], '220')
        self.assertEqual(result['final_price'], '3480.00')

    def test_railings_stairs_demolition_and_extras(self):
        result = self.calculate({'include_railings': True, 'railing_length': 40, 'railing_rate': 20,
                                 'include_stairs': True, 'stair_count': 5, 'stair_rate': 100,
                                 'include_demolition': True, 'demolition_area': 300, 'demolition_rate': 2, 'disposal': 100,
                                 'extras': [{'name': 'Footings', 'unit': 'each', 'quantity': 4, 'rate': 150}]})
        self.assertEqual(result['final_price'], '2600.00')

    def test_disabled_scopes_ignore_stored_rates(self):
        result = self.calculate({'area': 200, 'framing_rate': 10, 'railing_length': 40, 'railing_rate': 20,
                                 'stair_count': 5, 'stair_rate': 100, 'demolition_area': 300, 'demolition_rate': 2})
        self.assertEqual(result['final_price'], '0.00')

    def test_customer_boards_preserve_other_work(self):
        result = self.calculate({'area': 200, 'material_rate': 4, 'material_supplier': 'client', 'labor_rate': 3,
                                 'include_framing': True, 'framing_rate': 10})
        self.assertEqual(result['final_price'], '2600.00')
        self.assertEqual(result['sections'][0]['line_items'][0]['amount'], '0.00')

    def test_multiple_sections_and_pricing(self):
        _, result = calculate_decking_estimate({'sections': [{'area': 100, 'labor_rate': 2}, {'area': 200, 'labor_rate': 1}], 'profit_method': 'margin', 'profit': 20, 'discount': 10})
        self.assertEqual(result['final_price'], '450.00')

    def test_invalid_inputs(self):
        for section in ({'area': -1}, {'area': 'NaN'}, {'waste': 101}, {'stair_count': 2.5},
                        {'measurement': 'bad'}, {'material': ''}, {'include_framing': 'yes'},
                        {'measurement': 'dimensions', 'length': 1000000, 'width': 1000000},
                        {'extras': [{'unit': 'unknown'}]}, {'area': 1000000, 'material_rate': 1000000}):
            with self.subTest(section=section), self.assertRaises(ValidationError):
                self.calculate(section)


class DeckingApiTests(APITestCase):
    def test_preview_save_reopen_update_and_owner_isolation(self):
        inputs = {'sections': [{'name': 'Back deck', 'material': 'Composite', 'product_name': 'Grey boards',
                                'area': 200, 'material_rate': 4, 'labor_rate': 3, 'include_framing': True, 'framing_rate': 10}]}
        preview = self.client.post('/api/estimates/decking_preview/', inputs, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(self.client.post('/api/estimates/', {'estimate_type': 'decking', 'project_name': 'Deck', 'inputs': inputs}, format='json').status_code, 401)
        self.client.force_authenticate(get_user_model().objects.create_user(username='decking-owner'))
        saved = self.client.post('/api/estimates/', {'estimate_type': 'decking', 'project_name': 'Deck', 'inputs': inputs, 'final_price': '1.00'}, format='json')
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data['final_price'], '3480.00')
        url = f"/api/estimates/{saved.data['id']}/"
        self.assertTrue(self.client.get(url).data['inputs']['sections'][0]['include_framing'])
        inputs['sections'][0]['include_framing'] = False
        self.assertEqual(self.client.patch(url, {'inputs': inputs}, format='json').data['final_price'], '1480.00')
        self.client.force_authenticate(get_user_model().objects.create_user(username='decking-other'))
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, {'project_name': 'Other'}, format='json').status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
