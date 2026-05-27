from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0030_profile_contractor_categories_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="contractor_onboarding_completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="profile",
            name="contractor_onboarding_dismissed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
