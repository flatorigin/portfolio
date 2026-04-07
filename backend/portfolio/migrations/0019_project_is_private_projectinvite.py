from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_private_jobs_and_invites(apps, schema_editor):
    Project = apps.get_model("portfolio", "Project")
    ProjectInvite = apps.get_model("portfolio", "ProjectInvite")
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)

    for project in Project.objects.filter(post_privacy="private").exclude(is_private=True):
        project.is_private = True
        project.save(update_fields=["is_private"])

    for project in Project.objects.filter(is_job_posting=True, is_private=True).exclude(private_contractor_username=""):
        contractor = User.objects.filter(username=project.private_contractor_username).first()
        if contractor is None:
            continue
        ProjectInvite.objects.update_or_create(
            project=project,
            contractor=contractor,
            defaults={"status": "invited"},
        )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("portfolio", "0018_rename_legacy_project_bid_relation"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="is_private",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="ProjectInvite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("invited", "Invited"), ("accepted", "Accepted"), ("declined", "Declined")], default="invited", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("contractor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="project_invites", to=settings.AUTH_USER_MODEL)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="invites", to="portfolio.project")),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddConstraint(
            model_name="projectinvite",
            constraint=models.UniqueConstraint(fields=("project", "contractor"), name="unique_project_invite_per_contractor"),
        ),
        migrations.RunPython(backfill_private_jobs_and_invites, migrations.RunPython.noop),
    ]
