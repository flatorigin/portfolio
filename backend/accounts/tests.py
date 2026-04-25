from django.contrib.auth import get_user_model
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.test import override_settings
from django.utils import timezone
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import MessageThread, PrivateMessage, Project, ProjectImage
from .models import (
    AIConfiguration,
    AIUsageEvent,
    AdminAuditLog,
    Profile,
    StaffAccess,
    UserReport,
    get_ai_remaining_today_for_user,
    user_can_access_admin,
)


User = get_user_model()


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class RegistrationFlowTests(APITestCase):
    def test_registration_creates_profile_with_selected_role_and_sends_activation_email(self):
        response = self.client.post(
            "/api/auth/users/",
            {
                "username": "new_homeowner",
                "email": "new_homeowner@example.com",
                "password": "pw12345678",
                "profile_type": Profile.ProfileType.HOMEOWNER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username="new_homeowner")
        self.assertFalse(user.is_active)
        self.assertEqual(user.profile.profile_type, Profile.ProfileType.HOMEOWNER)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("activation", mail.outbox[0].subject.lower())
        self.assertIn("/activate/", mail.outbox[0].body)


@override_settings(AI_ENABLED=True, OPENAI_API_KEY="test-key")
class AIAssistViewTests(APITestCase):
    def setUp(self):
        self.homeowner = User.objects.create_user(
            username="homeowner1",
            email="homeowner1@example.com",
            password="pw12345678",
        )
        Profile.objects.update_or_create(
            user=self.homeowner,
            defaults={"profile_type": Profile.ProfileType.HOMEOWNER},
        )

        self.contractor = User.objects.create_user(
            username="contractor1",
            email="contractor1@example.com",
            password="pw12345678",
        )
        Profile.objects.update_or_create(
            user=self.contractor,
            defaults={"profile_type": Profile.ProfileType.CONTRACTOR},
        )

        AIConfiguration.get_solo()

    @patch("accounts.views.generate_text")
    def test_homeowner_can_use_project_summary_helper(self, mock_generate_text):
        mock_generate_text.return_value = {"text": "Drafted summary", "model": "gpt-5.4-mini"}
        self.client.force_authenticate(self.homeowner)

        response = self.client.post(
            "/api/ai/assist/",
            {
                "feature": "project_summary",
                "title": "Bathroom remodel",
                "current_text": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["text"], "Drafted summary")
        self.assertEqual(AIUsageEvent.objects.filter(user=self.homeowner).count(), 1)

    @patch("accounts.views.generate_text")
    def test_homeowner_cannot_use_bid_helper(self, mock_generate_text):
        self.client.force_authenticate(self.homeowner)

        response = self.client.post(
            "/api/ai/assist/",
            {
                "feature": "bid_proposal",
                "title": "Deck build",
                "current_text": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        mock_generate_text.assert_not_called()

    @patch("accounts.views.generate_text")
    def test_daily_limit_is_enforced(self, mock_generate_text):
        mock_generate_text.return_value = {"text": "Drafted bio", "model": "gpt-5.4-mini"}
        self.client.force_authenticate(self.contractor)

        config = AIConfiguration.get_solo()
        config.enabled = True
        config.daily_limit_per_user = 1
        config.save()

        first = self.client.post(
            "/api/ai/assist/",
            {
                "feature": "profile_bio",
                "current_text": "",
            },
            format="json",
        )
        second = self.client.post(
            "/api/ai/assist/",
            {
                "feature": "profile_bio",
                "current_text": "",
            },
            format="json",
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    @patch("accounts.views.generate_text")
    def test_profile_override_daily_limit_is_enforced(self, mock_generate_text):
        mock_generate_text.return_value = {"text": "Drafted bio", "model": "gpt-5.4-mini"}
        self.client.force_authenticate(self.contractor)

        config = AIConfiguration.get_solo()
        config.enabled = True
        config.daily_limit_per_user = 10
        config.save()

        self.contractor.profile.ai_daily_limit_override = 1
        self.contractor.profile.save(update_fields=["ai_daily_limit_override"])

        first = self.client.post(
            "/api/ai/assist/",
            {
                "feature": "profile_bio",
                "current_text": "",
            },
            format="json",
        )
        second = self.client.post(
            "/api/ai/assist/",
            {
                "feature": "profile_bio",
                "current_text": "",
            },
            format="json",
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_remaining_today_uses_profile_override_when_present(self):
        config = AIConfiguration.get_solo()
        config.daily_limit_per_user = 10
        config.save()

        self.contractor.profile.ai_daily_limit_override = 3
        self.contractor.profile.save(update_fields=["ai_daily_limit_override"])
        AIUsageEvent.objects.create(
            user=self.contractor,
            feature=AIUsageEvent.Feature.PROFILE_BIO,
            status=AIUsageEvent.Status.SUCCESS,
        )

        remaining, limit = get_ai_remaining_today_for_user(self.contractor, config=config)

        self.assertEqual(limit, 3)
        self.assertEqual(remaining, 2)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    AI_ENABLED=True,
    OPENAI_API_KEY="test-key",
)
class AccountSecurityTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="securityuser",
            email="security@example.com",
            password="pw12345678",
            is_active=True,
        )
        Profile.objects.update_or_create(
            user=self.user,
            defaults={"profile_type": Profile.ProfileType.CONTRACTOR},
        )

    def test_send_verification_email(self):
        self.user.profile.email_verified_at = None
        self.user.profile.save(update_fields=["email_verified_at"])
        self.client.force_authenticate(self.user)

        response = self.client.post("/api/users/me/security/send-verification/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("verify", mail.outbox[0].subject.lower())
        self.assertIn("/activate/", mail.outbox[0].body)

    def test_change_password(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/users/me/security/change-password/",
            {
                "current_password": "pw12345678",
                "new_password": "newsecurepw123",
                "new_password_confirm": "newsecurepw123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newsecurepw123"))

    def test_deactivate_hides_public_profile(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            "/api/users/me/security/deactivate/",
            {"is_deactivated": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)
        response = self.client.get(f"/api/profiles/{self.user.username}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_account_blocks_email_reuse(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/users/me/security/delete/",
            {"password": "pw12345678"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(User.objects.filter(username="securityuser").exists())

        register_response = self.client.post(
            "/api/auth/users/",
            {
                "username": "securityuser2",
                "email": "security@example.com",
                "password": "pw12345678",
                "profile_type": Profile.ProfileType.HOMEOWNER,
            },
            format="json",
        )
        self.assertEqual(register_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be used", str(register_response.data).lower())


class MeProfilePersistenceTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="persistuser",
            email="persist@example.com",
            password="pw12345678",
            is_active=True,
        )
        Profile.objects.update_or_create(
            user=self.user,
            defaults={
                "profile_type": Profile.ProfileType.CONTRACTOR,
                "service_location": "Philadelphia, PA",
                "contact_email": "persist@example.com",
                "contact_phone": "555-111-2222",
            },
        )

    def test_service_location_persists_after_profile_patch(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            "/api/users/me/",
            {
                "service_location": "Boston, MA",
                "service_lat": 42.3601,
                "service_lng": -71.0589,
                "contact_email": "persist@example.com",
                "contact_phone": "555-111-2222",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["service_location"], "Boston, MA")
        self.assertEqual(response.data["service_lat"], 42.3601)
        self.assertEqual(response.data["service_lng"], -71.0589)

        follow_up = self.client.get("/api/users/me/")
        self.assertEqual(follow_up.status_code, status.HTTP_200_OK)
        self.assertEqual(follow_up.data["service_location"], "Boston, MA")
        self.assertEqual(follow_up.data["service_lat"], 42.3601)
        self.assertEqual(follow_up.data["service_lng"], -71.0589)

    def test_contractor_verification_fields_round_trip_on_profile_patch(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            "/api/users/me/",
            {
                "profile_type": Profile.ProfileType.CONTRACTOR,
                "license_number": "PA-12345",
                "license_state": "PA",
                "insurance_provider": "Acme Mutual",
                "insurance_policy_number": "POL-7788",
                "insurance_expires_at": "2027-06-30",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["license_number"], "PA-12345")
        self.assertEqual(response.data["license_state"], "PA")
        self.assertEqual(response.data["insurance_provider"], "Acme Mutual")
        self.assertEqual(response.data["insurance_policy_number"], "POL-7788")
        self.assertEqual(response.data["effective_verification_status"], Profile.VerificationStatus.PENDING)
        self.assertEqual(response.data["verification_badge_label"], "Verification pending")

        self.user.refresh_from_db()
        self.assertEqual(self.user.profile.license_number, "PA-12345")
        self.assertIsNotNone(self.user.profile.verification_submitted_at)

    def test_service_location_persists_after_multipart_profile_patch(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            "/api/users/me/",
            {
                "service_location": "Boston, MA",
                "service_lat": "42.3601",
                "service_lng": "-71.0589",
                "contact_email": "persist@example.com",
                "contact_phone": "555-111-2222",
                "profile_type": Profile.ProfileType.CONTRACTOR,
                "display_name": "",
                "hero_headline": "",
                "hero_blurb": "",
                "bio": "",
                "show_contact_email": "false",
                "show_contact_phone": "false",
                "languages": "[]",
                "allow_direct_messages": "true",
                "dm_opt_out_reason": "",
                "dm_opt_out_until": "",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["service_location"], "Boston, MA")
        self.assertEqual(response.data["service_lat"], 42.3601)
        self.assertEqual(response.data["service_lng"], -71.0589)

        follow_up = self.client.get("/api/users/me/")
        self.assertEqual(follow_up.status_code, status.HTTP_200_OK)
        self.assertEqual(follow_up.data["service_location"], "Boston, MA")
        self.assertEqual(follow_up.data["service_lat"], 42.3601)
        self.assertEqual(follow_up.data["service_lng"], -71.0589)


class AdminSecurityTests(TestCase):
    def test_staff_user_without_staff_access_cannot_access_admin(self):
        user = User.objects.create_user(
            username="staff_no_access",
            email="staff_no_access@example.com",
            password="pw12345678!",
            is_staff=True,
            is_active=True,
        )

        self.assertFalse(user_can_access_admin(user))

    def test_staff_user_with_staff_access_can_access_admin(self):
        user = User.objects.create_user(
            username="staff_with_access",
            email="staff_with_access@example.com",
            password="pw12345678!",
            is_staff=True,
            is_active=True,
        )
        StaffAccess.objects.create(
            user=user,
            role=StaffAccess.Role.MODERATOR,
            can_access_admin=True,
            can_manage_moderation=True,
        )

        self.assertTrue(user_can_access_admin(user))

    def test_successful_admin_login_creates_audit_log(self):
        user = User.objects.create_user(
            username="ops_admin",
            email="ops_admin@example.com",
            password="pw12345678!",
            is_staff=True,
            is_active=True,
        )
        StaffAccess.objects.create(
            user=user,
            role=StaffAccess.Role.SUPERADMIN,
            can_access_admin=True,
            can_manage_accounts=True,
            can_manage_moderation=True,
            can_manage_verification=True,
            can_manage_compliance=True,
        )

        response = self.client.post(
            "/admin/login/?next=/admin/",
            {"username": "ops_admin", "password": "pw12345678!"},
            follow=True,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            AdminAuditLog.objects.filter(
                actor=user,
                event_type=AdminAuditLog.EventType.ADMIN_LOGIN,
            ).exists()
        )


class VerificationStatusTests(TestCase):
    def test_verified_status_expires_when_expiration_date_passes(self):
        user = User.objects.create_user(
            username="verifiedcontractor",
            email="verifiedcontractor@example.com",
            password="pw12345678",
            is_active=True,
        )
        profile = Profile.objects.create(
            user=user,
            profile_type=Profile.ProfileType.CONTRACTOR,
            verification_status=Profile.VerificationStatus.VERIFIED,
            verification_expires_at=timezone.localdate() - timedelta(days=1),
        )

        self.assertEqual(profile.effective_verification_status, Profile.VerificationStatus.EXPIRED)
        self.assertEqual(profile.verification_badge_label, "Verification expired")


class ReportFlowTests(APITestCase):
    def setUp(self):
        self.reporter = User.objects.create_user(
            username="reporter",
            email="reporter@example.com",
            password="pw12345678",
            is_active=True,
        )
        self.homeowner = User.objects.create_user(
            username="homeowner_report_target",
            email="homeowner_report_target@example.com",
            password="pw12345678",
            is_active=True,
        )
        self.contractor = User.objects.create_user(
            username="contractor_report_target",
            email="contractor_report_target@example.com",
            password="pw12345678",
            is_active=True,
        )
        Profile.objects.update_or_create(
            user=self.reporter,
            defaults={"profile_type": Profile.ProfileType.CONTRACTOR},
        )
        self.homeowner_profile, _ = Profile.objects.update_or_create(
            user=self.homeowner,
            defaults={
                "profile_type": Profile.ProfileType.HOMEOWNER,
                "public_profile_enabled": True,
            },
        )
        Profile.objects.update_or_create(
            user=self.contractor,
            defaults={"profile_type": Profile.ProfileType.CONTRACTOR},
        )

    def test_user_can_report_public_profile(self):
        self.client.force_authenticate(self.reporter)

        response = self.client.post(
            "/api/reports/",
            {
                "target_type": "profile",
                "target_id": self.homeowner_profile.id,
                "report_type": "fraud",
                "details": "Suspicious claims on the profile.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(UserReport.objects.count(), 1)
        report = UserReport.objects.get()
        self.assertEqual(report.target_user, self.homeowner)
        self.assertEqual(report.report_type, UserReport.ReportType.FRAUD)

    def test_user_can_report_public_project_image(self):
        project = Project.objects.create(
            owner=self.homeowner,
            title="Kitchen refresh",
            summary="Public project",
            is_public=True,
        )
        image_buffer = BytesIO()
        Image.new("RGB", (4, 4), color="white").save(image_buffer, format="PNG")
        image_buffer.seek(0)
        image = ProjectImage.objects.create(
            project=project,
            image=SimpleUploadedFile("test.png", image_buffer.read(), content_type="image/png"),
            caption="Project image",
        )

        self.client.force_authenticate(self.reporter)
        response = self.client.post(
            "/api/reports/",
            {
                "target_type": "project_image",
                "target_id": image.id,
                "report_type": "copyright",
                "details": "This image looks copied.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = UserReport.objects.get(target_object_id=image.id)
        self.assertEqual(report.target_user, self.homeowner)

    def test_thread_participant_can_report_private_message(self):
        thread, _ = MessageThread.get_or_create_dm(self.reporter, self.homeowner, initiated_by=self.reporter)
        message = PrivateMessage.objects.create(thread=thread, sender=self.homeowner, text="Abusive message")

        self.client.force_authenticate(self.reporter)
        response = self.client.post(
            "/api/reports/",
            {
                "target_type": "private_message",
                "target_id": message.id,
                "report_type": "harassment",
                "details": "This message crosses the line.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        report = UserReport.objects.get(target_object_id=message.id)
        self.assertEqual(report.target_user, self.homeowner)
        self.assertEqual(report.priority, UserReport.Priority.HIGH)

    def test_user_cannot_report_message_they_cannot_access(self):
        outsider = User.objects.create_user(
            username="outsider",
            email="outsider@example.com",
            password="pw12345678",
            is_active=True,
        )
        Profile.objects.update_or_create(
            user=outsider,
            defaults={"profile_type": Profile.ProfileType.CONTRACTOR},
        )
        thread, _ = MessageThread.get_or_create_dm(self.homeowner, self.contractor, initiated_by=self.homeowner)
        message = PrivateMessage.objects.create(thread=thread, sender=self.homeowner, text="Private")

        self.client.force_authenticate(outsider)
        response = self.client.post(
            "/api/reports/",
            {
                "target_type": "private_message",
                "target_id": message.id,
                "report_type": "harassment",
                "details": "I should not see this.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
