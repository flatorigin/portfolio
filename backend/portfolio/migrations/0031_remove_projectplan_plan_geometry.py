from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("portfolio", "0030_projectplan_plan_geometry"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="projectplan",
            name="plan_geometry",
        ),
    ]
