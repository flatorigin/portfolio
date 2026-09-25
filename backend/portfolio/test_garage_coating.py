from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from .garage_coating_estimators import calculate_garage_coating_estimate, EXTRAS


class GarageCoatingCalculationTests(SimpleTestCase):
    def calculate(self, section, **pricing):
        return calculate_garage_coating_estimate({'sections': [section], **pricing})[1]

    def test_material_waste_and_independent_preparation_quantities(self):
        result = self.calculate({'measurement': 'dimensions', 'length': 20, 'width': 20,
                                 'material_rate': 2, 'labor_rate': 3, 'waste': 10,
                                 'include_preparation': True, 'preparation_quantity': 400, 'preparation_rate': 1,
                                 'include_cracks': True, 'cracks_quantity': 30, 'cracks_rate': 5, 'disposal': 50})
        self.assertEqual(result['final_price'], '2680.00')
        self.assertEqual(result['sections'][0]['area'], '400')
        self.assertEqual(result['sections'][0]['purchase_area'], '440')

    def test_customer_supply_excludes_only_coating_materials(self):
        result = self.calculate({'area': 100, 'material_supplier': 'client', 'material_rate': 10,
                                 'labor_rate': 2, 'include_flakes': True, 'flakes_quantity': 100, 'flakes_rate': 1})
        self.assertEqual(result['final_price'], '300.00')
        self.assertTrue(result['sections'][0]['line_items'][0]['customer_supplied'])

    def test_installed_price_does_not_double_count_hidden_material_labor_waste(self):
        result = self.calculate({'area': 100, 'pricing': 'installed', 'installed_rate': 6,
                                 'material_rate': 10, 'labor_rate': 10, 'waste': 50, 'material_supplier': 'client',
                                 'include_removal': True, 'removal_quantity': 50, 'removal_rate': 2,
                                 'preparation_quantity': 100, 'preparation_rate': 10})
        self.assertEqual(result['final_price'], '700.00')
        self.assertEqual(result['sections'][0]['purchase_area'], '100')

    def test_all_extras_and_disabled_values(self):
        section = {'area': 100, 'labor_rate': 1}
        for key, _, _ in EXTRAS:
            section.update({f'include_{key}': True, f'{key}_quantity': 3, f'{key}_rate': 2})
        self.assertEqual(self.calculate(section)['final_price'], '148.00')
        for key, _, _ in EXTRAS:
            section[f'include_{key}'] = False
        self.assertEqual(self.calculate(section)['final_price'], '100.00')

    def test_multiple_sections_and_shared_pricing(self):
        inputs, result = calculate_garage_coating_estimate({'sections': [
            {'area': 100, 'labor_rate': 1}, {'area': 50, 'labor_rate': 2}],
            'overhead': 10, 'profit': 20, 'profit_method': 'margin', 'tax': 10,
            'discount_type': 'fixed', 'discount': 2.5, 'output_preference': 'summary'})
        self.assertEqual(result['final_price'], '300.00')
        self.assertEqual(calculate_garage_coating_estimate(inputs)[1], result)
        self.assertEqual(self.calculate({'area': 10, 'labor_rate': 1}, minimum=100, discount=10)['final_price'], '90.00')

    def test_custom_material_and_specification_preserved(self):
        inputs, result = calculate_garage_coating_estimate({'sections': [{'material': 'Custom coating',
            'product_name': 'Contractor product', 'system_description': 'Primer, base, clear topcoat', 'notes': 'Gray finish'}]})
        self.assertEqual(inputs['sections'][0]['material'], 'Custom coating')
        self.assertEqual(result['sections'][0]['system_description'], 'Primer, base, clear topcoat')
        self.assertEqual(result['final_price'], '0.00')

    def test_validation(self):
        for item in ({'material_rate': -1}, {'labor_rate': 'NaN'}, {'area': 'Infinity'}, {'waste': 101},
                     {'material_supplier': 'other'}, {'pricing': 'other'}, {'measurement': 'other'},
                     {'include_cracks': 'true'}, {'cracks_quantity': -1}, {'material': ''},
                     {'name': ''}, {'system_description': 'x' * 241}, {'notes': 'x' * 1001},
                     {'measurement': 'dimensions', 'length': 10000, 'width': 10000},
                     {'area': 1000000, 'material_rate': 1000000}):
            with self.subTest(item=item), self.assertRaises(ValidationError):
                self.calculate(item)
        for raw in (None, [], {}, {'sections': []}, {'sections': [None]}, {'sections': [{}] * 51}):
            with self.subTest(raw=raw), self.assertRaises(ValidationError):
                calculate_garage_coating_estimate(raw)


class GarageCoatingApiTests(APITestCase):
    def test_preview_save_reopen_update_and_owner_isolation(self):
        owner = get_user_model().objects.create_user(username='coating-owner')
        other = get_user_model().objects.create_user(username='coating-other')
        inputs = {'sections': [{'area': 400, 'pricing': 'installed', 'installed_rate': 6}]}
        preview = self.client.post('/api/estimates/garage_coating_preview/', inputs, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(preview.data['final_price'], '2400.00')
        payload = {'estimate_type': 'garage_coating', 'project_name': 'Garage', 'inputs': inputs, 'final_price': '1.00'}
        self.assertEqual(self.client.post('/api/estimates/', payload, format='json').status_code, 401)
        self.client.force_authenticate(owner)
        saved = self.client.post('/api/estimates/', payload, format='json')
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data['final_price'], '2400.00')
        url = f"/api/estimates/{saved.data['id']}/"
        self.assertEqual(self.client.get(url).data['estimate_type'], 'garage_coating')
        inputs['sections'][0]['installed_rate'] = 7
        updated = self.client.patch(url, {'inputs': inputs}, format='json')
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data['final_price'], '2800.00')
        self.client.force_authenticate(other)
        for response in (self.client.get(url), self.client.patch(url, {'project_name': 'Other'}, format='json'), self.client.delete(url)):
            self.assertEqual(response.status_code, 404)
        self.client.force_authenticate(owner)
        self.assertEqual(self.client.delete(url).status_code, 204)
