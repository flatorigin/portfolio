from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("portfolio", "0020_projectlike"),
    ]

    operations = [
        migrations.AddField(
            model_name="privatemessage",
            name="context_project",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="context_messages",
                to="portfolio.project",
            ),
        ),
    ]
