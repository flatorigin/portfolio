from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from .plumbing_estimators import calculate_plumbing_estimate


def plumbing_inputs(unit_price=100):
    return {
        'projects': [{
            'id': 'project-1',
            'service_id': 'kitchen-faucet',
            'name': 'Add garage outlet',
            'location': 'Garage north wall',
            'line_items': [
                {'id': 'visit', 'name': 'Visit', 'quantity': 1, 'unit': 'visit', 'unit_price': 0, 'homeowner_unit_price': 0},
                {'id': 'pipe', 'name': 'Supply pipe', 'quantity': 20, 'unit': 'linear ft', 'unit_price': unit_price, 'homeowner_unit_price': 100},
                {'id': 'access', 'name': 'Pipe access', 'quantity': 1, 'unit': 'run', 'unit_price': 250,
                 'homeowner_unit_price': 250, 'required': False, 'included': False},
            ],
        }],
        'notes': 'Permit fees excluded.',
    }


class PlumbingCalculationTests(SimpleTestCase):
    def test_itemized_scope_uses_quantity_and_included_state(self):
        inputs, result = calculate_plumbing_estimate(plumbing_inputs())
        self.assertEqual(result['final_price'], '2000.00')
        self.assertEqual(result['sections'][0]['line_items'][1]['amount'], '2000.00')
        self.assertEqual(result['sections'][0]['line_items'][2]['amount'], '0.00')
        self.assertTrue(inputs['permit_fees_excluded'])
        self.assertEqual(inputs['pricing_year'], '2026-27')

    def test_contractor_price_is_preserved_separately_from_homeowner_baseline(self):
        inputs, result = calculate_plumbing_estimate(plumbing_inputs(unit_price=125))
        line = inputs['projects'][0]['line_items'][1]
        self.assertEqual(line['unit_price'], '125')
        self.assertEqual(line['homeowner_unit_price'], '100')
        self.assertEqual(result['final_price'], '2500.00')

    def test_public_preview_uses_plumbing_version(self):
        from rest_framework.test import APIClient
        response = APIClient().post('/api/estimates/plumbing_preview/', plumbing_inputs(), format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['version'], 'plumbing-v1')

    def test_validation(self):
        for raw in (None, [], {}, {'projects': []}, {'projects': [None]}, {'projects': [{}]}):
            with self.subTest(raw=raw), self.assertRaises(ValidationError):
                calculate_plumbing_estimate(raw)
        with self.assertRaises(ValidationError):
            calculate_plumbing_estimate({'projects': [{'name': 'Bad', 'line_items': [{'name': 'Pipe', 'unit_price': -1}]}]})


class PlumbingSharingApiTests(APITestCase):
    def setUp(self):
        self.homeowner = get_user_model().objects.create_user(username='plumbing-homeowner')
        self.contractor = get_user_model().objects.create_user(username='plumbing-contractor')
        self.other = get_user_model().objects.create_user(username='plumbing-other')

    def test_homeowner_share_contractor_revision_and_comparison_snapshot(self):
        self.client.force_authenticate(self.homeowner)
        saved = self.client.post('/api/estimates/', {
            'estimate_type': 'plumbing',
            'project_name': 'Kitchen faucet',
            'inputs': plumbing_inputs(),
        }, format='json')
        self.assertEqual(saved.status_code, 201, saved.data)
        estimate_id = saved.data['id']
        self.assertEqual(saved.data['final_price'], '2000.00')

        shared = self.client.post(f'/api/estimates/{estimate_id}/share/', {}, format='json')
        self.assertEqual(shared.status_code, 200, shared.data)
        self.assertEqual(shared.data['workflow_status'], 'shared')
        self.assertEqual(shared.data['homeowner_snapshot']['final_price'], '2000.00')
        token = shared.data['share_token']

        self.client.force_authenticate(None)
        public = self.client.get(f'/api/estimates/shared/{token}/')
        self.assertEqual(public.status_code, 200, public.data)
        self.assertEqual(public.data['viewer_role'], 'shared_viewer')

        self.client.force_authenticate(self.contractor)
        claimed = self.client.post(f'/api/estimates/shared/{token}/claim/', {}, format='json')
        self.assertEqual(claimed.status_code, 200, claimed.data)
        self.assertEqual(claimed.data['viewer_role'], 'contractor')
        revised_inputs = plumbing_inputs(unit_price=125)
        revised = self.client.patch(f'/api/estimates/{estimate_id}/', {
            'inputs': revised_inputs,
            'contractor_notes': 'Longer accessible pipe route confirmed.',
        }, format='json')
        self.assertEqual(revised.status_code, 200, revised.data)
        self.assertEqual(revised.data['final_price'], '2500.00')
        self.assertEqual(revised.data['homeowner_snapshot']['final_price'], '2000.00')

        returned = self.client.post(f'/api/estimates/{estimate_id}/return-revision/', {}, format='json')
        self.assertEqual(returned.status_code, 200, returned.data)
        self.assertEqual(returned.data['workflow_status'], 'contractor_revised')

        self.client.force_authenticate(self.homeowner)
        owner_view = self.client.get(f'/api/estimates/{estimate_id}/')
        self.assertEqual(owner_view.status_code, 200)
        self.assertEqual(owner_view.data['final_price'], '2500.00')
        self.assertEqual(owner_view.data['homeowner_snapshot']['final_price'], '2000.00')

    def test_only_one_contractor_can_claim_and_only_owner_can_delete(self):
        self.client.force_authenticate(self.homeowner)
        saved = self.client.post('/api/estimates/', {
            'estimate_type': 'plumbing', 'project_name': 'Plumbing', 'inputs': plumbing_inputs(),
        }, format='json')
        estimate_id = saved.data['id']
        token = self.client.post(f'/api/estimates/{estimate_id}/share/', {}, format='json').data['share_token']
        self.client.force_authenticate(self.contractor)
        self.assertEqual(self.client.post(f'/api/estimates/shared/{token}/claim/').status_code, 200)
        self.assertEqual(self.client.delete(f'/api/estimates/{estimate_id}/').status_code, 403)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(f'/api/estimates/shared/{token}/claim/').status_code, 403)
