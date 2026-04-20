from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0019_profile_security_fields_and_deletedemailblocklist"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="service_lat",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="profile",
            name="service_lng",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
