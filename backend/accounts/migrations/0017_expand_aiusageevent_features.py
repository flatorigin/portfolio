from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0016_aiconfiguration_aiusageevent"),
    ]

    operations = [
        migrations.AlterField(
            model_name="aiusageevent",
            name="feature",
            field=models.CharField(
                choices=[
                    ("project_summary", "Project summary"),
                    ("project_checklist", "Project checklist"),
                    ("bid_proposal", "Bid proposal"),
                    ("profile_headline", "Profile headline"),
                    ("profile_blurb", "Profile blurb"),
                    ("profile_bio", "Profile bio"),
                    ("planner_analyze", "Planner issue analysis"),
                    ("planner_options", "Planner solution paths"),
                    ("planner_draft", "Planner draft generation"),
                ],
                max_length=40,
            ),
        ),
    ]
