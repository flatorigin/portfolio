from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase
from .paving_estimators import calculate_paving_estimate
from .drywall_estimators import calculate_drywall_estimate


class PavingCalculationTests(SimpleTestCase):
    def test_whole_units_and_waste_do_not_inflate_labor(self):
        _, result = calculate_paving_estimate({'sections': [{'area': 500, 'coverage': 100, 'unit_price': 400, 'waste': 10, 'labor_rate': 2}]})
        self.assertEqual(result['sections'][0]['ordered_units'], '6')
        self.assertEqual(result['final_price'], '3400.00')

    def test_custom_material_bulk_and_client_supply(self):
        _, result = calculate_paving_estimate({'sections': [{'material': 'Gravel', 'measurement': 'dimensions', 'length': 20, 'width': 25, 'unit': 'ton', 'coverage': 200, 'unit_price': 100, 'material_supplier': 'client', 'labor_rate': 2}]})
        self.assertEqual(result['sections'][0]['ordered_units'], '2.5')
        self.assertEqual(result['sections'][0]['material_value'], '250.00')
        self.assertEqual(result['final_price'], '1000.00')

    def test_invalid_inputs(self):
        for section in ({'area': 100, 'coverage': 0}, {'area': 'NaN'}, {'unit': 'unknown'}, {'unit': 'custom'}, {'whole_units': 'false'}):
            with self.assertRaises(ValidationError):
                calculate_paving_estimate({'sections': [section]})

    def test_floor_estimates_and_measured_overrides(self):
        _, result = calculate_drywall_estimate({'sections': [{'measurement': 'floor', 'floor_area': 200, 'height': 8, 'ceilings': True}]})
        self.assertEqual(result['sections'][0]['wall_area'], '700')
        self.assertEqual(result['sections'][0]['ceiling_area'], '200')
        _, result = calculate_drywall_estimate({'sections': [{'measurement': 'floor', 'floor_area': 200, 'wall_override': True, 'wall_area': 480, 'opening_area': 20, 'openings_already_deducted': True}]})
        self.assertEqual(result['sections'][0]['net_area'], '480')

    def test_decorative_ceiling_is_separate_from_layers_and_removal(self):
        _, result = calculate_drywall_estimate({'sections': [{'walls': False, 'ceilings': True, 'ceiling_area': 300, 'additional_ceiling_area': 80, 'layers': 2, 'removal_rate': 1}]})
        section = result['sections'][0]
        self.assertEqual(section['gross_area'], '380')
        self.assertEqual(section['sheets'], 27)
        self.assertEqual(result['final_price'], '300.00')


class PavingApiTests(APITestCase):
    def test_preview_save_update_and_owner_isolation(self):
        inputs = {'sections': [{'area': 500, 'coverage': 100, 'unit_price': 400}]}
        preview = self.client.post('/api/estimates/paving_preview/', inputs, format='json')
        self.assertEqual(preview.status_code, 200, preview.data)
        self.client.force_authenticate(get_user_model().objects.create_user(username='paving-owner'))
        saved = self.client.post('/api/estimates/', {'estimate_type': 'paving', 'project_name': 'Patio', 'inputs': inputs, 'final_price': '1.00'}, format='json')
        self.assertEqual(saved.status_code, 201, saved.data)
        self.assertEqual(saved.data['final_price'], '2000.00')
        url = f"/api/estimates/{saved.data['id']}/"
        self.assertEqual(self.client.get(url).data['inputs']['sections'][0]['coverage'], '100')
        inputs['sections'][0]['area'] = 600
        self.assertEqual(self.client.patch(url, {'inputs': inputs}, format='json').data['final_price'], '2400.00')
        self.client.force_authenticate(get_user_model().objects.create_user(username='paving-other'))
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, {'project_name': 'Other'}, format='json').status_code, 404)
