from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from .trade_estimators import calculate_fencing_estimate, calculate_windows_estimate, calculate_doors_estimate


CALCULATORS = {'fencing': calculate_fencing_estimate, 'windows': calculate_windows_estimate, 'doors': calculate_doors_estimate}


class TradeCalculationTests(SimpleTestCase):
    def test_fence_separate_quantities(self):
        _, result = calculate_fencing_estimate({'sections': [{'length': 100, 'height': 6, 'material_rate': 12, 'labor_rate': 8,
            'include_posts': True, 'post_count': 14, 'post_rate': 50, 'include_gates': True, 'gate_count': 2, 'gate_rate': 250,
            'include_removal': True, 'removal_length': 120, 'removal_rate': 3, 'disposal': 100}]})
        self.assertEqual(result['final_price'], '3660.00')

    def test_window_and_door_costs_are_per_unit_not_area(self):
        for category in ('windows', 'doors'):
            with self.subTest(category=category):
                _, result = CALCULATORS[category]({'sections': [{'count': 3, 'width': 36, 'height': 80, 'material_rate': 400,
                    'labor_rate': 150, 'include_trim': True, 'trim_rate': 25, 'include_frame': True, 'frame_rate': 100,
                    'include_hardware': True, 'hardware_rate': 20, 'include_removal': True, 'removal_count': 2, 'removal_rate': 50}]})
                self.assertEqual(result['final_price'], '2185.00')

    def test_customer_supply_excludes_only_product(self):
        for category, calculator in CALCULATORS.items():
            with self.subTest(category=category):
                _, result = calculator({'sections': [{'length': 3, 'count': 3, 'material_rate': 400, 'material_supplier': 'client',
                    'labor_rate': 150, 'include_posts': True, 'post_count': 1, 'post_rate': 100,
                    'include_frame': True, 'frame_rate': 100}]})
                self.assertEqual(result['final_price'], '550.00' if category == 'fencing' else '750.00')
                self.assertTrue(result['sections'][0]['line_items'][0]['customer_supplied'])

    def test_disabled_extras_and_multiple_sections(self):
        for calculator in CALCULATORS.values():
            _, result = calculator({'sections': [{'length': 10, 'count': 10, 'labor_rate': 2, 'post_count': 3, 'post_rate': 200,
                'frame_rate': 300, 'trim_rate': 200, 'hardware_rate': 200, 'removal_length': 20, 'removal_count': 20, 'removal_rate': 100},
                {'length': 10, 'count': 10, 'labor_rate': 3}], 'profit': 20, 'profit_method': 'margin', 'discount': 10})
            self.assertEqual(result['final_price'], '56.25')

    def test_validation(self):
        for category, calculator in CALCULATORS.items():
            cases = [{'material_rate': -1}, {'labor_rate': 'NaN'}, {'material_supplier': 'other'}, {'include_removal': 'true'},
                     {'material': ''}, {'notes': 'x' * 1001}, {'length': 1000000, 'count': 1000000, 'material_rate': 1000000}]
            cases += [{'post_count': 1.5}, {'gate_count': -1}] if category == 'fencing' else [{'count': 1.5}, {'removal_count': 1.5}, {'installation': 'other'}]
            if category == 'doors':
                cases.append({'location': 'roof'})
            for item in cases:
                with self.subTest(category=category, item=item), self.assertRaises(ValidationError):
                    calculator({'sections': [item]})
            for raw in (None, [], {}, {'sections': []}, {'sections': [None]}, {'sections': [{}] * 51}):
                with self.subTest(category=category, raw=raw), self.assertRaises(ValidationError):
                    calculator(raw)


class TradeApiTests(APITestCase):
    def test_all_categories_preview_save_update_and_isolation(self):
        owner = get_user_model().objects.create_user(username='trade-owner')
        other = get_user_model().objects.create_user(username='trade-other')
        for category in CALCULATORS:
            with self.subTest(category=category):
                self.client.force_authenticate(None)
                inputs = {'sections': [{'name': 'Front', 'length': 10, 'count': 10, 'labor_rate': 20}]}
                preview = self.client.post(f'/api/estimates/{category}_preview/', inputs, format='json')
                self.assertEqual(preview.status_code, 200, preview.data)
                payload = {'estimate_type': category, 'project_name': f'{category} estimate', 'inputs': inputs, 'final_price': '1.00'}
                self.assertEqual(self.client.post('/api/estimates/', payload, format='json').status_code, 401)
                self.client.force_authenticate(owner)
                saved = self.client.post('/api/estimates/', payload, format='json')
                self.assertEqual(saved.status_code, 201, saved.data)
                self.assertEqual(saved.data['final_price'], '200.00')
                url = f"/api/estimates/{saved.data['id']}/"
                self.assertEqual(self.client.get(url).data['estimate_type'], category)
                inputs['sections'][0]['labor_rate'] = 30
                updated = self.client.patch(url, {'inputs': inputs}, format='json')
                self.assertEqual(updated.status_code, 200, updated.data)
                self.assertEqual(updated.data['final_price'], '300.00')
                self.client.force_authenticate(other)
                for response in (self.client.get(url), self.client.patch(url, {'project_name': 'Other'}, format='json'), self.client.delete(url)):
                    self.assertEqual(response.status_code, 404)
                self.client.force_authenticate(owner)
                self.assertEqual(self.client.delete(url).status_code, 204)
