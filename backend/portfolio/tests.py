from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Project, ProjectInvite


User = get_user_model()


class PrivateProjectAccessTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pw123456")
        self.invited = User.objects.create_user(username="invited", password="pw123456")
        self.outsider = User.objects.create_user(username="outsider", password="pw123456")

        self.private_job = Project.objects.create(
            owner=self.owner,
            title="Invite-only deck rebuild",
            is_job_posting=True,
            is_public=False,
            is_private=True,
            post_privacy="private",
            private_contractor_username=self.invited.username,
        )
        ProjectInvite.objects.create(
            project=self.private_job,
            contractor=self.invited,
            status=ProjectInvite.STATUS_INVITED,
        )

    def test_invited_contractor_can_view_private_job(self):
        self.client.force_authenticate(user=self.invited)
        response = self.client.get(f"/api/projects/{self.private_job.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_outsider_cannot_view_private_job(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f"/api/projects/{self.private_job.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_private_job_not_listed_in_public_job_feed(self):
        response = self.client.get("/api/projects/job-postings/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data]
        self.assertNotIn(self.private_job.id, ids)
