from django.contrib.auth import get_user_model
from io import BytesIO
import json
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AIConfiguration, AIUsageEvent, Profile
from .models import (
    Project,
    ProjectInvite,
    MessageThread,
    PrivateMessage,
    ProjectPlan,
    MessageAttachment,
    FeedbackTicket,
    FeedbackReply,
    PromotionSource,
    LocalPromotion,
)
from apps.bids.models import Bid


User = get_user_model()


def set_profile_type(user, profile_type, **defaults):
    profile, _ = Profile.objects.update_or_create(
        user=user,
        defaults={
            "profile_type": profile_type,
            **defaults,
        },
    )
    user._state.fields_cache["profile"] = profile
    return profile


class FeedbackTicketApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="feedbackuser",
            email="feedback@example.com",
            password="pw123456",
        )

    def test_requires_authentication(self):
        response = self.client.post(
            "/api/feedback/",
            {
                "category": "general_feedback",
                "subject": "Suggestion",
                "message": "This is helpful.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("portfolio.models.FeedbackTicket.send_internal_submission_notification")
    @patch("portfolio.models.FeedbackTicket.send_submission_confirmation")
    def test_creates_feedback_ticket_with_links_and_attachment(self, mock_email, mock_internal_email):
        self.client.force_authenticate(user=self.user)
        upload = SimpleUploadedFile(
            "screenshot.png",
            b"fake-image-content",
            content_type="image/png",
        )

        response = self.client.post(
            "/api/feedback/",
            {
                "category": "technical_support",
                "subject": "Upload issue",
                "message": "The upload flow needs help.",
                "links": "https://flatorigin.com/projects/1\nhttp://example.com/context",
                "attachments": [upload],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        ticket = FeedbackTicket.objects.get(id=response.data["id"])
        self.assertEqual(ticket.user, self.user)
        self.assertEqual(ticket.links, ["https://flatorigin.com/projects/1", "http://example.com/context"])
        self.assertEqual(ticket.attachments.count(), 1)
        mock_email.assert_called_once()
        mock_internal_email.assert_called_once()

    def test_rejects_unsafe_link_protocol(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/feedback/",
            {
                "category": "general_feedback",
                "subject": "Bad link",
                "message": "Please check this.",
                "links": "javascript:alert(1)",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(FeedbackTicket.objects.count(), 0)

    def test_rejects_invalid_attachment_type(self):
        self.client.force_authenticate(user=self.user)
        upload = SimpleUploadedFile(
            "payload.exe",
            b"not allowed",
            content_type="application/octet-stream",
        )

        response = self.client.post(
            "/api/feedback/",
            {
                "category": "technical_support",
                "subject": "Attachment",
                "message": "Testing attachment validation.",
                "attachments": [upload],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(FeedbackTicket.objects.count(), 0)

    def test_lists_only_current_user_feedback_tickets(self):
        other = User.objects.create_user(username="otherfeedback", password="pw123456")
        mine = FeedbackTicket.objects.create(
            user=self.user,
            category="general_feedback",
            subject="Mine",
            message="My ticket",
        )
        FeedbackTicket.objects.create(
            user=other,
            category="general_feedback",
            subject="Other",
            message="Other ticket",
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/feedback/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [mine.id])

    @patch("portfolio.models.FeedbackReply.send_created_notification")
    def test_user_can_reply_to_own_feedback_ticket(self, mock_notify):
        ticket = FeedbackTicket.objects.create(
            user=self.user,
            category="technical_support",
            subject="Need help",
            message="Initial message",
        )
        self.client.force_authenticate(user=self.user)
        upload = SimpleUploadedFile(
            "detail.txt",
            b"more context",
            content_type="text/plain",
        )

        response = self.client.post(
            f"/api/feedback/{ticket.id}/replies/",
            {
                "message": "Here is more information.",
                "attachments": [upload],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        reply = FeedbackReply.objects.get(id=response.data["id"])
        self.assertEqual(reply.ticket, ticket)
        self.assertEqual(reply.author, self.user)
        self.assertFalse(reply.is_staff_reply)
        self.assertEqual(reply.attachments.count(), 1)
        mock_notify.assert_called_once()

    def test_user_cannot_reply_to_another_users_feedback_ticket(self):
        other = User.objects.create_user(username="otherfeedback2", password="pw123456")
        ticket = FeedbackTicket.objects.create(
            user=other,
            category="technical_support",
            subject="Not mine",
            message="Initial message",
        )
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            f"/api/feedback/{ticket.id}/replies/",
            {"message": "Trying to reply."},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(FeedbackReply.objects.count(), 0)


class LocalPromotionTests(APITestCase):
    def setUp(self):
        self.source = PromotionSource.objects.create(
            name="Media Supply",
            website_url="https://example.com/promos",
            business_name="Media Supply",
            category="Materials",
            city="Media",
            state="PA",
            zip_code="19063",
        )

    def test_public_endpoint_returns_only_approved_active_promotions(self):
        visible = LocalPromotion.objects.create(
            source=self.source,
            title="Deck board sale",
            business_name="Media Supply",
            category="Materials",
            promotion_text="Save 15% on deck boards this week.",
            product_or_service_name="Deck boards",
            website_url="https://example.com/promos",
            city="Media",
            state="PA",
            zip_code="19063",
            admin_approved=True,
            is_active=True,
        )
        LocalPromotion.objects.create(
            source=self.source,
            title="Hidden draft",
            business_name="Media Supply",
            category="Materials",
            promotion_text="Draft only.",
            website_url="https://example.com/promos",
            admin_approved=False,
            is_active=True,
        )

        response = self.client.get("/api/local-promotions/?search=deck&role=homeowner")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [visible.id])
        self.assertEqual(response.data[0]["note"], "Promotion details should be verified with the business.")

    @patch("portfolio.promotion_scraper.fetch_page_text")
    def test_scrape_source_extracts_promotions_as_unpublished_drafts(self, mock_fetch_page_text):
        from .promotion_scraper import scrape_source

        mock_fetch_page_text.return_value = [
            "About our local supply store",
            "Media, PA 19063",
            "Seasonal special: save 20% on pressure-treated lumber through 12/31/2026. Coupon code DECK20.",
            "Contact us for regular hours.",
        ]
        self.source.name = ""
        self.source.business_name = ""
        self.source.category = ""
        self.source.city = ""
        self.source.state = ""
        self.source.zip_code = ""
        self.source.save()

        result = scrape_source(self.source, delay=False)

        self.assertEqual(result.status, PromotionSource.STATUS_SUCCESS)
        self.assertEqual(result.found, 1)
        self.source.refresh_from_db()
        self.assertEqual(self.source.name, "Example")
        self.assertEqual(self.source.business_name, "Example")
        self.assertEqual(self.source.category, "Lumber & Materials")
        self.assertEqual(self.source.city, "Media")
        self.assertEqual(self.source.state, "PA")
        self.assertEqual(self.source.zip_code, "19063")
        promotion = LocalPromotion.objects.get(source=self.source)
        self.assertFalse(promotion.admin_approved)
        self.assertFalse(promotion.is_active)
        self.assertIn("save 20%", promotion.promotion_text.lower())
        self.assertEqual(promotion.coupon_code, "DECK20")

    @patch("portfolio.promotion_scraper.fetch_page_text")
    def test_scrape_source_updates_changed_existing_promotion(self, mock_fetch_page_text):
        from .promotion_scraper import scrape_source

        mock_fetch_page_text.return_value = [
            "Seasonal special: save 10% on pressure-treated lumber. Coupon code DECK10.",
        ]
        first = scrape_source(self.source, delay=False)
        self.assertEqual(first.added, 1)

        mock_fetch_page_text.return_value = [
            "Seasonal special: save 20% on pressure-treated lumber. Coupon code DECK20.",
        ]
        second = scrape_source(self.source, delay=False)

        self.assertEqual(second.added, 0)
        self.assertEqual(second.updated, 1)
        self.assertEqual(LocalPromotion.objects.filter(source=self.source).count(), 1)
        promotion = LocalPromotion.objects.get(source=self.source)
        self.assertIn("save 20%", promotion.promotion_text.lower())
        self.assertEqual(promotion.coupon_code, "DECK20")


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

    def test_public_job_feed_sorts_by_owner_profile_coordinates(self):
        near_owner = User.objects.create_user(username="nearowner", password="pw123456")
        Profile.objects.update_or_create(
            user=near_owner,
            defaults={
                "profile_type": Profile.ProfileType.HOMEOWNER,
                "service_lat": 39.9526,
                "service_lng": -75.1652,
            },
        )
        far_owner = User.objects.create_user(username="farowner", password="pw123456")
        Profile.objects.update_or_create(
            user=far_owner,
            defaults={
                "profile_type": Profile.ProfileType.HOMEOWNER,
                "service_lat": 42.3601,
                "service_lng": -71.0589,
            },
        )
        far_job = Project.objects.create(
            owner=far_owner,
            title="Boston kitchen",
            is_job_posting=True,
            is_public=True,
            is_private=False,
            post_privacy="public",
        )
        near_job = Project.objects.create(
            owner=near_owner,
            title="Philadelphia deck",
            is_job_posting=True,
            is_public=True,
            is_private=False,
            post_privacy="public",
        )

        response = self.client.get("/api/projects/job-postings/?lat=39.9526&lng=-75.1652")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [near_job.id, far_job.id])
        self.assertEqual(response.data[0]["distance_miles"], 0.0)
        self.assertIsNotNone(response.data[1]["distance_miles"])

    def test_contractor_search_filters_to_active_unfrozen_contractors(self):
        contractor = User.objects.create_user(username="deckpro", password="pw123456")
        set_profile_type(
            contractor,
            Profile.ProfileType.CONTRACTOR,
            display_name="Deck Pro",
            service_location="Media, PA",
            contact_email="deck@example.com",
            contact_phone="555-111-2222",
        )
        homeowner = User.objects.create_user(username="homeowner", password="pw123456")
        set_profile_type(
            homeowner,
            Profile.ProfileType.HOMEOWNER,
            display_name="Home Owner",
            service_location="Media, PA",
            contact_email="home@example.com",
            contact_phone="555-111-3333",
        )
        frozen = User.objects.create_user(username="frozenpro", password="pw123456")
        set_profile_type(
            frozen,
            Profile.ProfileType.CONTRACTOR,
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
        set_profile_type(
            deck_contractor,
            Profile.ProfileType.CONTRACTOR,
            display_name="Outdoor Structure Co",
            service_location="Media, PA",
            bio="Deck rebuilds, pergolas, and exterior carpentry.",
            contractor_primary_category="General Contractor",
            contractor_categories=["Finish Carpenter", "Deck Builder"],
            contact_email="deckbuilder@example.com",
            contact_phone="555-111-7777",
        )
        painter = User.objects.create_user(username="painter", password="pw123456")
        set_profile_type(
            painter,
            Profile.ProfileType.CONTRACTOR,
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

    def test_contractor_search_matches_hidden_contractor_categories(self):
        contractor = User.objects.create_user(username="hiddenfinish", password="pw123456")
        set_profile_type(
            contractor,
            Profile.ProfileType.CONTRACTOR,
            display_name="All Around Builder",
            service_location="Media, PA",
            contractor_primary_category="General Contractor",
            contractor_categories=["Finish Carpenter", "Cabinet Maker / Installer"],
            contact_email="hiddenfinish@example.com",
            contact_phone="555-111-9999",
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.get("/api/profiles/contractors/search/?q=finish%20carpenter")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = [item["username"] for item in response.data]
        self.assertIn("hiddenfinish", usernames)
        self.assertEqual(response.data[0]["contractor_primary_category"], "General Contractor")

    def test_contractor_search_matches_contractor_project_titles(self):
        deck_contractor = User.objects.create_user(username="outdoorpro", password="pw123456")
        set_profile_type(
            deck_contractor,
            Profile.ProfileType.CONTRACTOR,
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
        set_profile_type(
            painter,
            Profile.ProfileType.CONTRACTOR,
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
            set_profile_type(
                user,
                Profile.ProfileType.CONTRACTOR,
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
        set_profile_type(
            contractor,
            Profile.ProfileType.CONTRACTOR,
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

    def test_legacy_public_project_without_compliance_can_still_be_edited(self):
        project = Project.objects.create(
            owner=self.owner,
            title="Legacy public project",
            summary="Old public row.",
            is_public=True,
            compliance_confirmed=False,
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            f"/api/projects/{project.id}/",
            {
                "title": "Legacy public project updated",
                "summary": project.summary,
                "is_public": True,
                "compliance_confirmed": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project.refresh_from_db()
        self.assertEqual(project.title, "Legacy public project updated")

    def test_publishing_project_requires_compliance_confirmation(self):
        project = Project.objects.create(
            owner=self.owner,
            title="Draft project",
            summary="Draft row.",
            is_public=False,
            compliance_confirmed=False,
        )

        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            f"/api/projects/{project.id}/",
            {
                "is_public": True,
                "compliance_confirmed": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("compliance_confirmed", response.data)


class MessagePrefillTests(APITestCase):
    def setUp(self):
        self.homeowner = User.objects.create_user(username="homeowner", password="pw123456")
        self.contractor = User.objects.create_user(username="contractor", password="pw123456")
        self.contractor_two = User.objects.create_user(username="contractortwo", password="pw123456")
        self.other_homeowner = User.objects.create_user(username="otherhome", password="pw123456")

        set_profile_type(self.homeowner, Profile.ProfileType.HOMEOWNER)
        set_profile_type(self.contractor, Profile.ProfileType.CONTRACTOR)
        set_profile_type(self.contractor_two, Profile.ProfileType.CONTRACTOR)
        set_profile_type(self.other_homeowner, Profile.ProfileType.HOMEOWNER)

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

    def test_direct_thread_messages_endpoint_returns_text(self):
        self.client.force_authenticate(user=self.homeowner)
        response = self.client.get(
            f"/api/messages/threads/{self.direct_thread.id}/messages/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            response.data[0]["text"],
            "We need a bathroom remodel with warmer tile and better lighting.",
        )

    def test_project_thread_messages_endpoint_returns_text(self):
        self.client.force_authenticate(user=self.homeowner)
        response = self.client.get(
            f"/api/projects/{self.project.id}/threads/{self.project_thread.id}/messages/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            response.data[0]["text"],
            "I can handle this for 4500 and finish in two weeks.",
        )

    def test_project_thread_message_image_is_saved_as_attachment(self):
        self.client.force_authenticate(user=self.contractor)
        upload = SimpleUploadedFile(
            "marked.png",
            BytesIO(b"message image bytes").read(),
            content_type="image/png",
        )

        response = self.client.post(
            f"/api/projects/{self.project.id}/threads/{self.project_thread.id}/messages/",
            {"text": "", "images": [upload]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["text"], "")
        self.assertEqual(len(response.data["attachments"]), 1)
        self.assertEqual(response.data["attachments"][0]["kind"], "image")
        self.assertEqual(response.data["attachments"][0]["name"], "marked.png")
        self.assertTrue(
            MessageAttachment.objects.filter(
                message_id=response.data["id"],
                kind="image",
                original_name="marked.png",
            ).exists()
        )

        inbox_response = self.client.get("/api/inbox/threads/")
        self.assertEqual(inbox_response.status_code, status.HTTP_200_OK)
        thread_row = next(item for item in inbox_response.data if item["id"] == self.project_thread.id)
        self.assertEqual(thread_row["latest_message"]["attachment_name"], "marked.png")

    def test_contractor_can_start_direct_message_with_homeowner(self):
        self.client.force_authenticate(user=self.contractor)
        response = self.client.post(
            "/api/messages/start/",
            {"username": self.homeowner.username},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("thread_id", response.data)

        thread = MessageThread.objects.get(id=response.data["thread_id"])
        self.assertTrue(thread.user_is_participant(self.contractor))
        self.assertTrue(thread.user_is_participant(self.homeowner))


class ProjectPlannerTests(APITestCase):
    def setUp(self):
        self.homeowner = User.objects.create_user(username="plannerhome", password="pw123456")
        self.contractor = User.objects.create_user(username="plannerpro", password="pw123456")
        set_profile_type(self.homeowner, Profile.ProfileType.HOMEOWNER)
        set_profile_type(self.contractor, Profile.ProfileType.CONTRACTOR)
        config = AIConfiguration.get_solo()
        config.enabled = True
        config.project_helper_enabled = True
        config.daily_limit_per_user = 10
        config.save()

    def test_homeowner_can_only_have_three_active_plans(self):
        self.client.force_authenticate(user=self.homeowner)
        for index in range(3):
            response = self.client.post(
                "/api/project-plans/",
                {"title": f"Issue {index + 1}", "status": "planning"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.post(
            "/api/project-plans/",
            {"title": "Overflow issue", "status": "planning"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("up to 3 project plans", str(response.data).lower())

    def test_archived_plan_keeps_capacity_until_deleted(self):
        self.client.force_authenticate(user=self.homeowner)
        plan = ProjectPlan.objects.create(owner=self.homeowner, title="Window", status=ProjectPlan.STATUS_PLANNING)
        ProjectPlan.objects.create(owner=self.homeowner, title="Porch", status=ProjectPlan.STATUS_PLANNING)
        ProjectPlan.objects.create(owner=self.homeowner, title="Bathroom", status=ProjectPlan.STATUS_READY_TO_DRAFT)

        response = self.client.post(f"/api/project-plans/{plan.id}/archive/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(
            "/api/project-plans/",
            {"title": "New opening", "status": "planning"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.delete(f"/api/project-plans/{plan.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        response = self.client.post(
            "/api/project-plans/",
            {"title": "New opening", "status": "planning"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_archived_plan_can_be_unarchived(self):
        self.client.force_authenticate(user=self.homeowner)
        plan = ProjectPlan.objects.create(owner=self.homeowner, title="Window", status=ProjectPlan.STATUS_ARCHIVED)

        response = self.client.post(f"/api/project-plans/{plan.id}/unarchive/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        plan.refresh_from_db()
        self.assertEqual(plan.status, ProjectPlan.STATUS_PLANNING)

    def test_contractor_cannot_access_project_planner(self):
        self.client.force_authenticate(user=self.contractor)
        response = self.client.get("/api/project-plans/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_convert_plan_to_private_draft_job_post(self):
        plan = ProjectPlan.objects.create(
            owner=self.homeowner,
            title="Rotten porch board",
            issue_summary="Board near the front steps is soft.",
            house_location="Front porch",
            notes="Need someone to inspect and likely replace it.",
            contractor_types=["carpenter"],
            links=[{"url": "https://example.com/reference", "label": "Reference", "notes": ""}],
        )
        image = SimpleUploadedFile(
            "porch.gif",
            (
                b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!"
                b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
                b"\x00\x02\x02D\x01\x00;"
            ),
            content_type="image/gif",
        )
        plan_image = plan.images.create(image=image, caption="Close up", order=0, is_cover=True)
        plan.markup_data = {
            "versions": [
                {
                    "id": "version-test",
                    "name": "Close up markup",
                    "source_image_id": plan_image.id,
                    "snapshot_url": "https://example.com/markup.png",
                    "annotation_count": 2,
                    "annotations": [{"type": "arrow", "x": 10, "y": 20}],
                    "visible_layers": {"scope": True},
                }
            ]
        }
        plan.save(update_fields=["markup_data"])

        self.client.force_authenticate(user=self.homeowner)
        response = self.client.post(f"/api/project-plans/{plan.id}/convert-to-draft/", {"use_ai": False}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        draft = Project.objects.get(id=response.data["draft_id"])
        plan.refresh_from_db()
        self.assertTrue(draft.is_job_posting)
        self.assertFalse(draft.is_public)
        self.assertEqual(draft.owner_id, self.homeowner.id)
        self.assertEqual(plan.status, ProjectPlan.STATUS_CONVERTED)
        self.assertEqual(plan.converted_job_post_id, draft.id)
        self.assertEqual(draft.title, "Rotten porch board")
        self.assertEqual(draft.category, "Front porch")
        self.assertEqual(draft.location, "Front porch")
        self.assertEqual(draft.job_summary, "Board near the front steps is soft.")
        self.assertIn("Need someone to inspect", draft.summary)
        self.assertEqual(draft.service_categories, ["carpenter"])
        copied_image = draft.images.get()
        self.assertEqual(copied_image.caption, "Close up")
        self.assertEqual(copied_image.extra_data["source"], "project_planner")
        self.assertEqual(copied_image.extra_data["source_plan_id"], plan.id)
        self.assertEqual(copied_image.extra_data["markup_version"]["id"], "version-test")
        self.assertEqual(copied_image.extra_data["markup_version"]["annotation_count"], 2)

    @patch("portfolio.views.generate_text")
    def test_planner_ai_action_uses_shared_quota(self, mock_generate_text):
        mock_generate_text.return_value = {
            "text": json.dumps(
                {
                    "likely_issue_label": "Rotten exterior trim",
                    "explanation": "Water damage around the frame.",
                    "contractor_types": ["carpenter"],
                    "next_steps": ["Inspect surrounding trim"],
                }
            ),
            "model": "gpt-test",
        }
        plan = ProjectPlan.objects.create(
            owner=self.homeowner,
            title="Window trim",
            notes="Wood is soft on the outside edge.",
        )

        self.client.force_authenticate(user=self.homeowner)
        response = self.client.post(
            f"/api/project-plans/{plan.id}/ai/",
            {"action": "analyze_issue"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            AIUsageEvent.objects.filter(user=self.homeowner, status=AIUsageEvent.Status.SUCCESS).count(),
            1,
        )
