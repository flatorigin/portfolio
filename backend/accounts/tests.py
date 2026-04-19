from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase

from .models import AIConfiguration, AIUsageEvent, Profile, get_ai_remaining_today_for_user


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
