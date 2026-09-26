from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from .models import ProjectEstimate

class EstimateCardActionsTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username='estimate-owner')
        self.other = get_user_model().objects.create_user(username='estimate-other')
        self.estimate = ProjectEstimate.objects.create(user=self.owner, project_name='Client work', estimate_type='painting', final_price=500, calculation={'sections': [{'name': 'Kitchen', 'line_items': [{'name': 'Walls'}]}]})
        self.client.force_authenticate(self.owner)

    def test_pin_is_personal_and_persists(self):
        url = f'/api/estimates/{self.estimate.pk}/pin/'
        self.assertEqual(self.client.post(url, {'pinned': True}, format='json').status_code, 200)
        self.assertTrue(self.client.get(f'/api/estimates/{self.estimate.pk}/').data['is_pinned'])
        self.estimate.shared_with = self.other
        self.estimate.save()
        self.client.force_authenticate(self.other)
        self.assertFalse(self.client.get(f'/api/estimates/{self.estimate.pk}/').data['is_pinned'])
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(url, {'pinned': False}, format='json').status_code, 200)
        self.assertFalse(self.estimate.pinned_by.exists())

    def test_client_snapshot_is_read_only_and_deleted_with_estimate(self):
        response = self.client.post(f'/api/estimates/{self.estimate.pk}/client-share/')
        self.assertEqual(response.status_code, 200)
        url = f"/api/estimates/client/{response.data['token']}/"
        self.estimate.refresh_from_db()
        self.estimate.final_price = 900
        self.estimate.save()
        self.client.force_authenticate(None)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['final_price'], '500.00')
        self.assertNotIn('inputs', response.data)
        self.assertNotIn('share_token', response.data)
        self.assertEqual(self.client.patch(url, {'final_price': 1}).status_code, 405)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(f'/api/estimates/{self.estimate.pk}/client-share/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/estimates/{self.estimate.pk}/').status_code, 404)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.delete(f'/api/estimates/{self.estimate.pk}/').status_code, 204)
        self.assertEqual(self.client.get(url).status_code, 404)
