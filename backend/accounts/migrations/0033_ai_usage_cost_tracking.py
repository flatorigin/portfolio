import decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0032_profile_homeowner_onboarding"),
    ]

    operations = [
        migrations.AddField(
            model_name="aiconfiguration",
            name="company_markup_percent",
            field=models.DecimalField(
                decimal_places=2,
                default=decimal.Decimal("100.00"),
                help_text="Percentage added to the estimated provider cost. 100% means the user price is 2x provider cost.",
                max_digits=6,
            ),
        ),
        migrations.AddField(
            model_name="aiconfiguration",
            name="minimum_charge_usd",
            field=models.DecimalField(
                decimal_places=4,
                default=decimal.Decimal("0.0100"),
                help_text="Minimum displayed user price for each successful AI action.",
                max_digits=8,
            ),
        ),
        migrations.AddField(
            model_name="aiusageevent",
            name="input_tokens",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="aiusageevent",
            name="output_tokens",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="aiusageevent",
            name="provider_cost_usd",
            field=models.DecimalField(
                decimal_places=6,
                default=decimal.Decimal("0"),
                max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name="aiusageevent",
            name="user_charge_usd",
            field=models.DecimalField(
                decimal_places=6,
                default=decimal.Decimal("0"),
                max_digits=12,
            ),
        ),
    ]
