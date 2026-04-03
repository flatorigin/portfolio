from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("portfolio", "0017_projectbid_projectbidversion_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="projectbid",
            name="project",
            field=models.ForeignKey(
                on_delete=models.CASCADE,
                related_name="legacy_project_bids",
                to="portfolio.project",
            ),
        ),
    ]
