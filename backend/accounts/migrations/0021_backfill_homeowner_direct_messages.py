from django.db import migrations


def enable_homeowner_direct_messages(apps, schema_editor):
    Profile = apps.get_model("accounts", "Profile")
    Profile.objects.filter(
        profile_type="homeowner",
        allow_direct_messages=False,
    ).update(allow_direct_messages=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0020_profile_service_lat_lng"),
    ]

    operations = [
        migrations.RunPython(
            enable_homeowner_direct_messages,
            reverse_code=noop_reverse,
        ),
    ]
