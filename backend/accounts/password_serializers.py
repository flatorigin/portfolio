from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.conf import settings
from django.utils.encoding import force_str, force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers

User = get_user_model()
token_generator = PasswordResetTokenGenerator()


class PasswordResetRequestSerializer(serializers.Serializer):
    """
    Takes an email, and if a user with that email exists,
    sends a reset link to that email.

    Important:
    - Does not leak whether the email exists (always behaves the same to caller)
    - Handles duplicate emails safely (email is not unique by default in Django)
    """
    email = serializers.EmailField()

    def validate_email(self, value):
        return value

    def save(self, **kwargs):
        email = self.validated_data["email"].strip()

        users = User.objects.filter(email__iexact=email, is_active=True)

        # Silently do nothing; we still return 200 in the view
        if not users.exists():
            return

        base_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com")

        subject = "Reset your password"

        for user in users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = token_generator.make_token(user)

            reset_link = f"{base_url}/reset-password?uid={uid}&token={token}"
            message = (
                "You requested a password reset.\n\n"
                f"Click the link below to set a new password:\n{reset_link}\n\n"
                "If you didn't request this, you can ignore this email."
            )

            send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=[user.email],
                fail_silently=False,
            )


class PasswordResetConfirmSerializer(serializers.Serializer):
    """
    Takes uid + token + new_password and sets the user's password
    if the token is valid.
    """
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate(self, attrs):
        uid = attrs.get("uid")
        token = attrs.get("token")

        try:
            uid_int = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=uid_int)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError("Invalid reset link")

        if not token_generator.check_token(user, token):
            raise serializers.ValidationError("Invalid or expired reset token")

        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        new_password = self.validated_data["new_password"]
        user.set_password(new_password)
        user.save()
        return user