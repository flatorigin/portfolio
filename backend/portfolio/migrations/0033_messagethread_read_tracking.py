from django.db import migrations, models
from django.utils import timezone


def initialize_existing_threads_as_read(apps, schema_editor):
    MessageThread = apps.get_model("portfolio", "MessageThread")
    migrated_at = timezone.now()
    MessageThread.objects.update(
        owner_last_read_at=migrated_at,
        client_last_read_at=migrated_at,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("portfolio", "0032_project_view_count"),
    ]

    operations = [
        migrations.AddField(
            model_name="messagethread",
            name="owner_last_read_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="messagethread",
            name="client_last_read_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(
            initialize_existing_threads_as_read,
            migrations.RunPython.noop,
        ),
    ]
