# accounts/serializers.py
from rest_framework import serializers
from .models import Profile

class MeSerializer(serializers.ModelSerializer):
    avatar = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Profile
        fields = ("id", "avatar")

    def update(self, instance, validated_data):
        # Clear on null
        if "avatar" in validated_data and validated_data["avatar"] is None:
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = None
        # Set on new file
        elif "avatar" in validated_data and validated_data["avatar"] is not None:
            instance.avatar = validated_data["avatar"]
        instance.save()
        return instance

