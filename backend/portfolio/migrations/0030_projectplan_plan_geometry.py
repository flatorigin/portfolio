from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("portfolio", "0029_alter_helperlisting_owner"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectplan",
            name="plan_geometry",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
