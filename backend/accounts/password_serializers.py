from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_str, force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import serializers

User = get_user_model()
token_generator = PasswordResetTokenGenerator()


class PasswordResetRequestSerializer(serializers.Serializer):
    """
    Takes an email, and if a user with that email exists,
    sends a reset link to that email.
    """
    email = serializers.EmailField()

    def validate_email(self, value):
        # Don't leak whether the email exists or not
        return value

    def save(self, **kwargs):
        email = self.validated_data["email"]

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Silently do nothing; we still return 200 in the view
            return

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)

        # FRONTEND_URL should be in your settings.py
        reset_link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

        subject = "Reset your password"
        message = (
            "You requested a password reset.\n\n"
            f"Click the link below to set a new password:\n{reset_link}\n\n"
            "If you didn't request this, you can ignore this email."
        )

        send_mail(
            subject,
            message,
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com"),
            [email],
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
