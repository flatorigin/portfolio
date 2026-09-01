from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("portfolio", "0031_remove_projectplan_plan_geometry"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="view_count",
            field=models.PositiveBigIntegerField(default=0),
        ),
    ]
