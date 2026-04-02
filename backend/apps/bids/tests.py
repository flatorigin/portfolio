from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import Project
from portfolio.models import MessageThread, PrivateMessage
from .models import Bid


User = get_user_model()


class BidFlowTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pw123456")
        self.contractor = User.objects.create_user(
            username="contractor", password="pw123456"
        )
        self.project = Project.objects.create(
            owner=self.owner,
            title="Kitchen remodel",
            is_public=True,
            is_job_posting=True,
        )

    def test_contractor_can_submit_bid(self):
        self.client.force_authenticate(user=self.contractor)
        response = self.client.post(
            f"/api/projects/{self.project.id}/bids/",
            {
                "price_type": "fixed",
                "amount": "2500.00",
                "proposal_text": "Ready to start next week.",
                "timeline_text": "2 weeks",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Bid.objects.count(), 1)
        self.assertEqual(Bid.objects.get().contractor, self.contractor)
        self.assertEqual(Bid.objects.get().proposal_text, "Ready to start next week.")

    def test_owner_cannot_bid_on_own_project(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/projects/{self.project.id}/bids/",
            {
                "price_type": "fixed",
                "amount": "2500.00",
                "proposal_text": "Owner bid.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_accept_bid(self):
        bid = Bid.objects.create(
            project=self.project,
            contractor=self.contractor,
            price_type=Bid.PRICE_TYPE_FIXED,
            amount="2500.00",
            proposal_text="Ready to start next week.",
            message="Ready to start next week.",
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(f"/api/bids/{bid.id}/accept/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bid.refresh_from_db()
        self.assertEqual(bid.status, Bid.STATUS_ACCEPTED)
        self.assertTrue(
            MessageThread.objects.filter(project=self.project).exists()
        )
        self.assertTrue(
            PrivateMessage.objects.filter(
                thread__project=self.project,
                sender=self.owner,
                text__icontains="was accepted",
            ).exists()
        )

    def test_contractor_cannot_accept_own_bid(self):
        bid = Bid.objects.create(
            project=self.project,
            contractor=self.contractor,
            price_type=Bid.PRICE_TYPE_FIXED,
            amount="2500.00",
            proposal_text="Ready to start next week.",
            message="Ready to start next week.",
        )

        self.client.force_authenticate(user=self.contractor)
        response = self.client.post(f"/api/bids/{bid.id}/accept/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_contractor_can_revise_pending_bid(self):
        bid = Bid.objects.create(
            project=self.project,
            contractor=self.contractor,
            price_type=Bid.PRICE_TYPE_FIXED,
            amount="2500.00",
            proposal_text="Initial bid.",
            message="Initial bid.",
        )

        self.client.force_authenticate(user=self.contractor)
        response = self.client.patch(
            f"/api/bids/{bid.id}/",
            {
                "price_type": "fixed",
                "amount": "3000.00",
                "proposal_text": "Updated bid.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bid.refresh_from_db()
        self.assertEqual(str(bid.amount), "3000.00")
        self.assertEqual(bid.message, "Updated bid.")
        self.assertEqual(bid.proposal_text, "Updated bid.")

    def test_new_bids_blocked_after_acceptance(self):
        Bid.objects.create(
            project=self.project,
            contractor=self.contractor,
            price_type=Bid.PRICE_TYPE_FIXED,
            amount="2500.00",
            proposal_text="Accepted bid.",
            message="Accepted bid.",
            status=Bid.STATUS_ACCEPTED,
        )
        other = User.objects.create_user(username="other", password="pw123456")

        self.client.force_authenticate(user=other)
        response = self.client.post(
            f"/api/projects/{self.project.id}/bids/",
            {
                "price_type": "fixed",
                "amount": "2800.00",
                "proposal_text": "Late bid.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_legacy_message_field_maps_to_proposal_text(self):
        self.client.force_authenticate(user=self.contractor)
        response = self.client.post(
            f"/api/projects/{self.project.id}/bids/",
            {"price_type": "fixed", "amount": "2500.00", "message": "Legacy payload."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        bid = Bid.objects.get()
        self.assertEqual(bid.message, "Legacy payload.")
        self.assertEqual(bid.proposal_text, "Legacy payload.")
