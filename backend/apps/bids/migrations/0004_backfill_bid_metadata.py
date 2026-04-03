from django.db import migrations


def backfill_bid_metadata(apps, schema_editor):
    Bid = apps.get_model("bids", "Bid")

    accepted_qs = Bid.objects.filter(status="accepted")
    for bid in accepted_qs.iterator():
        changed = []

        if (not bid.proposal_text) and bid.message:
            bid.proposal_text = bid.message
            changed.append("proposal_text")

        if bid.accepted_at is None:
            bid.accepted_at = bid.updated_at or bid.created_at
            changed.append("accepted_at")

        if bid.accepted_by_id is None and getattr(bid, "project_id", None):
            project = getattr(bid, "project", None)
            project_owner_id = getattr(project, "owner_id", None) if project else None
            if project_owner_id:
                bid.accepted_by_id = project_owner_id
                changed.append("accepted_by")

        if changed:
            bid.save(update_fields=changed)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("bids", "0003_bid_acceptance_metadata"),
    ]

    operations = [
        migrations.RunPython(backfill_bid_metadata, noop),
    ]
