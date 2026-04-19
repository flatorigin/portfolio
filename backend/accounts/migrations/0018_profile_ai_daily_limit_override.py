from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0017_expand_aiusageevent_features"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="ai_daily_limit_override",
            field=models.PositiveIntegerField(
                blank=True,
                help_text="Optional per-user override for the daily AI assist limit. Leave blank to use the global default.",
                null=True,
            ),
        ),
    ]
