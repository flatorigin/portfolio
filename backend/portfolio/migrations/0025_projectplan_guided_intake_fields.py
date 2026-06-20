from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("portfolio", "0024_projectplan_markup_data"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectplan",
            name="ai_generated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="projectplan",
            name="contractor_ready_status",
            field=models.CharField(
                choices=[
                    ("not_ready", "Not ready"),
                    ("needs_more_info", "Needs more info"),
                    ("ready_for_estimate", "Ready for estimate"),
                ],
                default="not_ready",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="projectplan",
            name="contractor_ready_summary_json",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="projectplan",
            name="guided_answers_json",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="projectplan",
            name="guided_question_index",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="projectplan",
            name="project_readiness_score",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="projectplan",
            name="project_type",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="projectplan",
            name="site_access",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="projectplan",
            name="visibility_status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("local_public", "Local Public"),
                    ("invite_only", "Invite Only"),
                    ("private", "Private"),
                ],
                default="draft",
                max_length=20,
            ),
        ),
    ]
