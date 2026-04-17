from django.contrib.auth import get_user_model
import json
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Profile
from .models import Project, ProjectInvite, MessageThread, PrivateMessage
from apps.bids.models import Bid


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

    def test_contractor_search_filters_to_active_unfrozen_contractors(self):
        contractor = User.objects.create_user(username="deckpro", password="pw123456")
        Profile.objects.create(
            user=contractor,
            profile_type=Profile.ProfileType.CONTRACTOR,
            display_name="Deck Pro",
            service_location="Media, PA",
            contact_email="deck@example.com",
            contact_phone="555-111-2222",
        )
        homeowner = User.objects.create_user(username="homeowner", password="pw123456")
        Profile.objects.create(
            user=homeowner,
            profile_type=Profile.ProfileType.HOMEOWNER,
            display_name="Home Owner",
            service_location="Media, PA",
            contact_email="home@example.com",
            contact_phone="555-111-3333",
        )
        frozen = User.objects.create_user(username="frozenpro", password="pw123456")
        Profile.objects.create(
            user=frozen,
            profile_type=Profile.ProfileType.CONTRACTOR,
            display_name="Frozen Pro",
            service_location="Media, PA",
            contact_email="frozen@example.com",
            contact_phone="555-111-4444",
            is_frozen=True,
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.get("/api/profiles/contractors/search/?q=Media")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = [item["username"] for item in response.data]
        self.assertIn("deckpro", usernames)
        self.assertNotIn("homeowner", usernames)
        self.assertNotIn("frozenpro", usernames)

    def test_contractor_search_can_use_project_keywords(self):
        deck_contractor = User.objects.create_user(username="deckbuilder", password="pw123456")
        Profile.objects.create(
            user=deck_contractor,
            profile_type=Profile.ProfileType.CONTRACTOR,
            display_name="Outdoor Structure Co",
            service_location="Media, PA",
            bio="Deck rebuilds, pergolas, and exterior carpentry.",
            contact_email="deckbuilder@example.com",
            contact_phone="555-111-7777",
        )
        painter = User.objects.create_user(username="painter", password="pw123456")
        Profile.objects.create(
            user=painter,
            profile_type=Profile.ProfileType.CONTRACTOR,
            display_name="Interior Paint Co",
            service_location="Media, PA",
            bio="Interior painting and drywall repair.",
            contact_email="painter@example.com",
            contact_phone="555-111-8888",
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.get("/api/profiles/contractors/search/?project_q=deck%20repair")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = [item["username"] for item in response.data]
        self.assertIn("deckbuilder", usernames)
        self.assertNotIn("painter", usernames)

    def test_contractor_search_matches_contractor_project_titles(self):
        deck_contractor = User.objects.create_user(username="outdoorpro", password="pw123456")
        Profile.objects.create(
            user=deck_contractor,
            profile_type=Profile.ProfileType.CONTRACTOR,
            display_name="Outdoor Structure Co",
            service_location="Media, PA",
            bio="Exterior work.",
            contact_email="outdoorpro@example.com",
            contact_phone="555-111-7777",
        )
        Project.objects.create(
            owner=deck_contractor,
            title="Cedar deck replacement",
            category="Outdoor",
            summary="Completed raised deck project.",
            is_public=True,
        )
        painter = User.objects.create_user(username="paintonly", password="pw123456")
        Profile.objects.create(
            user=painter,
            profile_type=Profile.ProfileType.CONTRACTOR,
            display_name="Interior Paint Co",
            service_location="Media, PA",
            bio="Interior painting only.",
            contact_email="paintonly@example.com",
            contact_phone="555-111-8888",
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.get("/api/profiles/contractors/search/?q=deck&search_by=job_title")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = [item["username"] for item in response.data]
        self.assertIn("outdoorpro", usernames)
        self.assertNotIn("paintonly", usernames)

    def test_private_job_creation_accepts_multiple_invited_contractors(self):
        first = User.objects.create_user(username="firstpro", password="pw123456")
        second = User.objects.create_user(username="secondpro", password="pw123456")
        for user in (first, second):
            Profile.objects.create(
                user=user,
                profile_type=Profile.ProfileType.CONTRACTOR,
                display_name=user.username,
                service_location="Media, PA",
                contact_email=f"{user.username}@example.com",
                contact_phone="555-111-5555",
            )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            "/api/projects/",
            {
                "title": "Private bath repair",
                "summary": "Fix the bath.",
                "is_job_posting": True,
                "is_public": False,
                "post_privacy": "private",
                "compliance_confirmed": True,
                "private_contractor_usernames": ["firstpro", "secondpro"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project = Project.objects.get(id=response.data["id"])
        self.assertTrue(project.is_private)
        self.assertEqual(project.private_contractor_username, "firstpro")
        self.assertEqual(project.invites.count(), 2)
        self.assertEqual(
            set(project.invites.values_list("contractor__username", flat=True)),
            {"firstpro", "secondpro"},
        )

    def test_private_job_multipart_creation_accepts_invited_contractors_json(self):
        contractor = User.objects.create_user(username="formpro", password="pw123456")
        Profile.objects.create(
            user=contractor,
            profile_type=Profile.ProfileType.CONTRACTOR,
            display_name="Form Pro",
            service_location="Media, PA",
            contact_email="formpro@example.com",
            contact_phone="555-111-6666",
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            "/api/projects/",
            {
                "title": "Multipart private job",
                "summary": "Private form data post.",
                "is_job_posting": "true",
                "is_public": "false",
                "post_privacy": "private",
                "compliance_confirmed": "true",
                "private_contractor_usernames": json.dumps(["formpro"]),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project = Project.objects.get(id=response.data["id"])
        self.assertEqual(project.private_contractor_username, "formpro")
        self.assertTrue(project.invites.filter(contractor=contractor).exists())


class MessagePrefillTests(APITestCase):
    def setUp(self):
        self.homeowner = User.objects.create_user(username="homeowner", password="pw123456")
        self.contractor = User.objects.create_user(username="contractor", password="pw123456")
        self.contractor_two = User.objects.create_user(username="contractortwo", password="pw123456")
        self.other_homeowner = User.objects.create_user(username="otherhome", password="pw123456")

        Profile.objects.create(user=self.homeowner, profile_type=Profile.ProfileType.HOMEOWNER)
        Profile.objects.create(user=self.contractor, profile_type=Profile.ProfileType.CONTRACTOR)
        Profile.objects.create(user=self.contractor_two, profile_type=Profile.ProfileType.CONTRACTOR)
        Profile.objects.create(user=self.other_homeowner, profile_type=Profile.ProfileType.HOMEOWNER)

        self.project = Project.objects.create(
            owner=self.homeowner,
            title="Cabinet refinish",
            summary="Kitchen cabinet job.",
            is_job_posting=True,
            is_public=True,
        )

        self.project_thread, _ = MessageThread.get_or_create_dm(
            self.homeowner,
            self.contractor,
            origin_project=self.project,
            initiated_by=self.homeowner,
        )
        self.project_thread.owner_has_accepted = True
        self.project_thread.client_has_accepted = True
        self.project_thread.save(update_fields=["owner_has_accepted", "client_has_accepted"])

        self.project_message = PrivateMessage.objects.create(
            thread=self.project_thread,
            sender=self.contractor,
            text="I can handle this for 4500 and finish in two weeks.",
        )

        self.direct_thread, _ = MessageThread.get_or_create_dm(
            self.homeowner,
            self.contractor_two,
            initiated_by=self.homeowner,
        )
        self.direct_thread.owner_has_accepted = True
        self.direct_thread.client_has_accepted = True
        self.direct_thread.save(update_fields=["owner_has_accepted", "client_has_accepted"])
        self.direct_message = PrivateMessage.objects.create(
            thread=self.direct_thread,
            sender=self.homeowner,
            text="We need a bathroom remodel with warmer tile and better lighting.",
        )

    def test_contractor_can_prefill_bid_from_project_thread_message(self):
        self.client.force_authenticate(user=self.contractor)
        response = self.client.post(f"/api/messages/{self.project_message.id}/prefill-bid/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["project_id"], self.project.id)
        self.assertEqual(response.data["project_title"], self.project.title)
        self.assertEqual(
            response.data["prefill"]["proposal_text"],
            "I can handle this for 4500 and finish in two weeks.",
        )

    def test_contractor_bid_prefill_requires_project_context(self):
        self.client.force_authenticate(user=self.contractor_two)
        response = self.client.post(f"/api/messages/{self.direct_message.id}/prefill-bid/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not linked to a project", str(response.data).lower())

    def test_homeowner_can_prefill_project_from_direct_thread_message(self):
        self.client.force_authenticate(user=self.homeowner)
        response = self.client.post(f"/api/messages/{self.direct_message.id}/prefill-project/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["suggested_private_invite_username"], "contractortwo")
        self.assertTrue(response.data["prefill"]["is_job_posting"])
        self.assertEqual(
            response.data["prefill"]["summary"],
            "We need a bathroom remodel with warmer tile and better lighting.",
        )

    def test_homeowner_cannot_prefill_project_for_project_linked_thread(self):
        self.client.force_authenticate(user=self.homeowner)
        response = self.client.post(f"/api/messages/{self.project_message.id}/prefill-project/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already linked to a project", str(response.data).lower())

    def test_homeowner_cannot_prefill_bid(self):
        self.client.force_authenticate(user=self.homeowner)
        response = self.client.post(f"/api/messages/{self.project_message.id}/prefill-bid/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_prefill_bid_blocks_existing_bid(self):
        Bid.objects.create(
            project=self.project,
            contractor=self.contractor,
            price_type=Bid.PRICE_TYPE_FIXED,
            amount="3500.00",
            proposal_text="Already sent.",
            message="Already sent.",
        )
        self.client.force_authenticate(user=self.contractor)
        response = self.client.post(f"/api/messages/{self.project_message.id}/prefill-bid/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already have a bid", str(response.data).lower())
