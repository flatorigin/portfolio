from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bids", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="bid",
            name="amount_max",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="bid",
            name="amount_min",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name="bid",
            name="attachment",
            field=models.FileField(blank=True, null=True, upload_to="bid_attachments/"),
        ),
        migrations.AddField(
            model_name="bid",
            name="excluded_text",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="bid",
            name="included_text",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="bid",
            name="payment_terms",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="bid",
            name="price_type",
            field=models.CharField(
                choices=[("fixed", "Fixed price"), ("range", "Estimate range")],
                default="fixed",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="bid",
            name="proposal_text",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="bid",
            name="timeline_text",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="bid",
            name="valid_until",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="bid",
            name="amount",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AlterField(
            model_name="bid",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("revision_requested", "Revision Requested"),
                    ("accepted", "Accepted"),
                    ("declined", "Declined"),
                    ("withdrawn", "Withdrawn"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]
