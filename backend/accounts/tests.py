from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Profile


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
