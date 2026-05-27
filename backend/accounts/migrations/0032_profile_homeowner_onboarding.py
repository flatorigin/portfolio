from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0031_profile_contractor_onboarding"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="homeowner_onboarding_completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="profile",
            name="homeowner_onboarding_dismissed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
