from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from .drywall_estimators import calculate_drywall_estimate


class DrywallCalculationTests(SimpleTestCase):
    def test_layers_waste_openings_and_finish_only_once(self):
        _, result = calculate_drywall_estimate({'sections': [{'wall_area': 100, 'opening_area': 20, 'layers': 2, 'sheet_price': 10, 'hanging_rate': 1, 'finishing_rate': 2}]})
        section = result['sections'][0]
        self.assertEqual(section['sheets'], 6)
        self.assertEqual(section['net_area'], '80')
        self.assertEqual(result['final_price'], '460.00')

    def test_installed_does_not_double_charge_material_or_labor(self):
        _, result = calculate_drywall_estimate({'sections': [{'wall_area': 100, 'pricing': 'installed', 'installed_rate': 3, 'sheet_price': 50, 'hanging_rate': 5, 'supplies': 500}]})
        self.assertEqual(result['final_price'], '300.00')

    def test_customer_materials_and_ceiling_dimensions(self):
        _, result = calculate_drywall_estimate({'sections': [{'walls': False, 'ceilings': True, 'measurement': 'dimensions', 'length': 10, 'width': 12, 'material_supplier': 'client', 'sheet_price': 20, 'supplies': 100, 'hanging_rate': 1}]})
        self.assertEqual(result['final_price'], '120.00')
        self.assertEqual(result['sections'][0]['sheets'], 5)

    def test_patches_margin_minimum_and_discount(self):
        _, result = calculate_drywall_estimate({'sections': [{'patch_count': 2, 'patch_rate': 50}], 'profit_method': 'margin', 'profit': 20, 'minimum': 150, 'discount': 10})
        self.assertEqual(result['final_price'], '135.00')

    def test_invalid_measurements(self):
        for section in ({'wall_area': 10, 'opening_area': 11}, {'layers': 1.5}, {'sheet_width': 0}, {'wall_area': 'NaN'}):
            with self.assertRaises(ValidationError):
                calculate_drywall_estimate({'sections': [section]})


class DrywallApiTests(APITestCase):
    def test_preview_save_update_and_private_access(self):
        inputs = {'sections': [{'wall_area': 100, 'pricing': 'installed', 'installed_rate': 3}]}
        preview = self.client.post('/api/estimates/drywall_preview/', inputs, format='json')
        self.assertEqual(preview.status_code, 200)
        user = get_user_model().objects.create_user(username='drywall-owner')
        self.client.force_authenticate(user)
        saved = self.client.post('/api/estimates/', {'estimate_type': 'drywall', 'project_name': 'Test', 'inputs': inputs}, format='json')
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data['final_price'], preview.data['final_price'])
        url = f"/api/estimates/{saved.data['id']}/"
        updated = self.client.patch(url, {'inputs': {'sections': [{'patch_count': 1, 'patch_rate': 80}]}}, format='json')
        self.assertEqual(updated.data['final_price'], '80.00')
        self.client.force_authenticate(get_user_model().objects.create_user(username='drywall-other'))
        self.assertEqual(self.client.get(url).status_code, 404)
