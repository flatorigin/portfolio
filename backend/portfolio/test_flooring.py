from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from .flooring_estimators import calculate_flooring_estimate


class FlooringCalculationTests(SimpleTestCase):
    def calculate(self, section, **pricing):
        return calculate_flooring_estimate({'sections': [section], **pricing})[1]

    def test_square_foot_material_waste_not_labor(self):
        result = self.calculate({'area': 300, 'material_rate': 2, 'labor_rate': 3})
        self.assertEqual(result['sections'][0]['purchase_area'], '330')
        self.assertEqual(result['final_price'], '1560.00')

    def test_package_rounding_and_exact_boundary(self):
        for area, expected in [(300, '17'), (200, '11'), (0, '0')]:
            result = self.calculate({'area': area, 'pricing': 'package', 'coverage': 20, 'package_price': 50, 'labor_rate': 3})
            self.assertEqual(result['sections'][0]['packages'], expected)
        result = self.calculate({'area': 300, 'pricing': 'package', 'coverage': 20, 'package_price': 50, 'labor_rate': 3})
        self.assertEqual(result['final_price'], '1750.00')
        self.assertEqual(result['sections'][0]['ordered_coverage'], '340')

    def test_dimensions_product_and_removal_override(self):
        result = self.calculate({'measurement': 'dimensions', 'length': 15, 'width': 20,
                                 'name': 'Living room', 'product_name': 'Oak LVP', 'brand_model': 'Sample 123',
                                 'remove_existing': True, 'removal_override': True, 'removal_area': 100, 'removal_rate': 2})
        self.assertEqual(result['sections'][0]['name'], 'Living room - Oak LVP')
        self.assertEqual(result['sections'][0]['area'], '300')
        self.assertEqual(result['final_price'], '200.00')

    def test_customer_material_excludes_only_flooring(self):
        result = self.calculate({'area': 100, 'material_rate': 50, 'material_supplier': 'client',
                                 'labor_rate': 2, 'remove_existing': True, 'removal_rate': 1,
                                 'preparation': 80, 'disposal': 20,
                                 'extras': [{'name': 'Stairs', 'unit': 'step', 'quantity': 4, 'rate': 25}]})
        self.assertEqual(result['final_price'], '500.00')
        self.assertEqual(result['sections'][0]['line_items'][0]['amount'], '0.00')

    def test_disabled_removal_ignores_stale_values(self):
        self.assertEqual(self.calculate({'area': 100, 'removal_area': 200, 'removal_override': True, 'removal_rate': 20})['final_price'], '0.00')

    def test_multiple_sections_and_shared_pricing(self):
        _, result = calculate_flooring_estimate({'sections': [{'area': 100, 'labor_rate': 2}, {'area': 200, 'labor_rate': 1}], 'profit_method': 'margin', 'profit': 20, 'discount': 10})
        self.assertEqual(result['final_price'], '450.00')

    def test_invalid_inputs(self):
        for section in ({'area': -1}, {'area': 'NaN'}, {'pricing': 'bad'}, {'area': 100, 'pricing': 'package', 'coverage': 0},
                        {'measurement': 'dimensions', 'length': 1000000, 'width': 1000000},
                        {'area': 100, 'remove_existing': True, 'removal_override': True, 'removal_area': 101},
                        {'remove_existing': 'yes'}, {'product_link': 'javascript:alert(1)'},
                        {'product_link': 'not a URL'}, {'extras': [{'unit': 'unknown'}]},
                        {'area': 1000000, 'material_rate': 1000000}):
            with self.subTest(section=section), self.assertRaises(ValidationError):
                self.calculate(section)


class FlooringApiTests(APITestCase):
    def test_preview_save_reopen_edit_and_owner_isolation(self):
        inputs = {'sections': [{'area': 300, 'name': 'Living room', 'product_name': 'Oak LVP',
                                'product_link': 'https://example.com/flooring', 'pricing': 'package',
                                'coverage': 20, 'package_price': 50, 'labor_rate': 3}]}
        preview = self.client.post('/api/estimates/flooring_preview/', inputs, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertEqual(self.client.post('/api/estimates/', {'estimate_type': 'flooring', 'project_name': 'Floor', 'inputs': inputs}, format='json').status_code, 401)
        self.client.force_authenticate(get_user_model().objects.create_user(username='floor-owner'))
        saved = self.client.post('/api/estimates/', {'estimate_type': 'flooring', 'project_name': 'Floor', 'inputs': inputs, 'final_price': '1.00'}, format='json')
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data['final_price'], '1750.00')
        url = f"/api/estimates/{saved.data['id']}/"
        self.assertEqual(self.client.get(url).data['inputs']['sections'][0]['product_name'], 'Oak LVP')
        inputs['sections'][0]['area'] = 200
        self.assertEqual(self.client.patch(url, {'inputs': inputs}, format='json').data['final_price'], '1150.00')
        self.client.force_authenticate(get_user_model().objects.create_user(username='floor-other'))
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, {'project_name': 'Other'}, format='json').status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
