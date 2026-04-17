from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Profile
from portfolio.models import MessageThread, PrivateMessage, Project, ProjectInvite

from .models import Bid


User = get_user_model()


class BidFlowTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pw123456")
        self.contractor = User.objects.create_user(username="contractor", password="pw123456")
        Profile.objects.create(user=self.owner, profile_type=Profile.ProfileType.HOMEOWNER)
        Profile.objects.create(user=self.contractor, profile_type=Profile.ProfileType.CONTRACTOR)
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
        bid = Bid.objects.get()
        self.assertEqual(bid.contractor, self.contractor)
        self.assertEqual(bid.proposal_text, "Ready to start next week.")

    def test_owner_cannot_bid_on_own_project(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/projects/{self.project.id}/bids/",
            {"price_type": "fixed", "amount": "2500.00", "proposal_text": "Owner bid."},
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
        self.assertTrue(MessageThread.objects.filter(project=self.project).exists())
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
        response = self.client.post(
            f"/api/bids/{bid.id}/revise/",
            {"price_type": "fixed", "amount": "3000.00", "proposal_text": "Updated bid."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bid.refresh_from_db()
        self.assertEqual(str(bid.amount), "3000.00")
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
        Profile.objects.create(user=other, profile_type=Profile.ProfileType.CONTRACTOR)

        self.client.force_authenticate(user=other)
        response = self.client.post(
            f"/api/projects/{self.project.id}/bids/",
            {"price_type": "fixed", "amount": "2800.00", "proposal_text": "Late bid."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_owner_can_reopen_accepted_job_post(self):
        bid = Bid.objects.create(
            project=self.project,
            contractor=self.contractor,
            price_type=Bid.PRICE_TYPE_FIXED,
            amount="2500.00",
            proposal_text="Accepted bid.",
            message="Accepted bid.",
            status=Bid.STATUS_ACCEPTED,
            accepted_by=self.owner,
            accepted_at=self.project.created_at,
        )
        other = User.objects.create_user(username="other", password="pw123456")
        Profile.objects.create(user=other, profile_type=Profile.ProfileType.CONTRACTOR)

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f"/api/bids/{bid.id}/reopen/",
            {"reopen_note": "We need to reopen the job and review fresh bids."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bid.refresh_from_db()
        self.assertEqual(bid.status, Bid.STATUS_REVISION_REQUESTED)
        self.assertIsNone(bid.accepted_at)
        self.assertIsNone(bid.accepted_by)
        self.assertTrue(
            PrivateMessage.objects.filter(
                thread__project=self.project,
                sender=self.owner,
                text__icontains="was reopened",
            ).exists()
        )

        self.client.force_authenticate(user=other)
        submit_response = self.client.post(
            f"/api/projects/{self.project.id}/bids/",
            {"price_type": "fixed", "amount": "2800.00", "proposal_text": "Fresh bid."},
            format="json",
        )
        self.assertEqual(submit_response.status_code, status.HTTP_201_CREATED)

    def test_invited_contractor_can_bid_on_private_job(self):
        private_project = Project.objects.create(
            owner=self.owner,
            title="Private kitchen remodel",
            is_job_posting=True,
            is_public=False,
            is_private=True,
            post_privacy="private",
            private_contractor_username=self.contractor.username,
        )
        ProjectInvite.objects.create(
            project=private_project,
            contractor=self.contractor,
            status=ProjectInvite.STATUS_INVITED,
        )

        self.client.force_authenticate(user=self.contractor)
        response = self.client.post(
            f"/api/projects/{private_project.id}/bids/",
            {
                "price_type": "fixed",
                "amount": "4100.00",
                "proposal_text": "Private invite bid.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_uninvited_contractor_cannot_bid_on_private_job(self):
        private_project = Project.objects.create(
            owner=self.owner,
            title="Private bath remodel",
            is_job_posting=True,
            is_public=False,
            is_private=True,
            post_privacy="private",
            private_contractor_username=self.contractor.username,
        )
        ProjectInvite.objects.create(
            project=private_project,
            contractor=self.contractor,
            status=ProjectInvite.STATUS_INVITED,
        )
        other = User.objects.create_user(username="outsider", password="pw123456")
        Profile.objects.create(user=other, profile_type=Profile.ProfileType.CONTRACTOR)

        self.client.force_authenticate(user=other)
        response = self.client.post(
            f"/api/projects/{private_project.id}/bids/",
            {
                "price_type": "fixed",
                "amount": "4200.00",
                "proposal_text": "Let me in.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_homeowner_cannot_submit_bid(self):
        homeowner = User.objects.create_user(username="homeowner_bidder", password="pw123456")
        Profile.objects.create(user=homeowner, profile_type=Profile.ProfileType.HOMEOWNER)

        self.client.force_authenticate(user=homeowner)
        response = self.client.post(
            f"/api/projects/{self.project.id}/bids/",
            {
                "price_type": "fixed",
                "amount": "1900.00",
                "proposal_text": "Attempting to bid as homeowner.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_seventh_active_bid_is_blocked(self):
        extra_contractors = [
            User.objects.create_user(username=f"contractor{i}", password="pw123456")
            for i in range(1, 7)
        ]
        for user in extra_contractors:
            Profile.objects.create(user=user, profile_type=Profile.ProfileType.CONTRACTOR)
        for index, user in enumerate(extra_contractors[:6], start=1):
            Bid.objects.create(
                project=self.project,
                contractor=user,
                price_type=Bid.PRICE_TYPE_FIXED,
                amount=f"{2000 + index}.00",
                proposal_text=f"Bid {index}",
                message=f"Bid {index}",
                status=Bid.STATUS_PENDING,
            )

        seventh = User.objects.create_user(username="contractor7", password="pw123456")
        Profile.objects.create(user=seventh, profile_type=Profile.ProfileType.CONTRACTOR)
        self.client.force_authenticate(user=seventh)
        response = self.client.post(
            f"/api/projects/{self.project.id}/bids/",
            {
                "price_type": "fixed",
                "amount": "5000.00",
                "proposal_text": "Seventh bid",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
