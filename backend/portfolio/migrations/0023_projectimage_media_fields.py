from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("portfolio", "0022_projectplan_projectplanimage"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectimage",
            name="media_type",
            field=models.CharField(
                choices=[("image", "Image"), ("video", "Video")],
                default="image",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="projectimage",
            name="thumbnail",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="project_images/thumbnails/",
            ),
        ),
        migrations.AddField(
            model_name="projectimage",
            name="processing_status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("processing", "Processing"),
                    ("ready", "Ready"),
                    ("failed", "Failed"),
                ],
                default="ready",
                max_length=20,
            ),
        ),
    ]
