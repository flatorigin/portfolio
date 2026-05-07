import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import BusinessDirectoryListing
from accounts.serializers import BusinessDirectoryListingSerializer


class Command(BaseCommand):
    help = "Import or update business directory listings from a JSON array."

    def add_arguments(self, parser):
        parser.add_argument("json_path", help="Path to a JSON file containing a list of business listings.")
        parser.add_argument(
            "--publish",
            action="store_true",
            help="Publish imported listings unless an item explicitly sets is_published.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and report what would change without writing to the database.",
        )

    def handle(self, *args, **options):
        path = Path(options["json_path"]).expanduser()
        if not path.exists() or not path.is_file():
            raise CommandError(f"JSON file not found: {path}")

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON: {exc}") from exc

        if not isinstance(payload, list):
            raise CommandError("Expected the JSON file to contain a list of business listings.")

        created = 0
        updated = 0
        skipped = 0
        errors = []

        with transaction.atomic():
            for index, raw_item in enumerate(payload, start=1):
                if not isinstance(raw_item, dict):
                    errors.append(f"Item {index}: expected an object.")
                    skipped += 1
                    continue

                item = self.normalize_item(raw_item, default_publish=options["publish"])
                serializer = BusinessDirectoryListingSerializer(data=item)
                if not serializer.is_valid():
                    errors.append(f"Item {index}: {serializer.errors}")
                    skipped += 1
                    continue

                validated = dict(serializer.validated_data)
                is_published = bool(item.get("is_published", False))
                is_removed = bool(item.get("is_removed", False))

                lookup = {
                    "business_name__iexact": validated["business_name"],
                    "location__iexact": validated["location"],
                }
                listing = BusinessDirectoryListing.objects.filter(**lookup).first()
                if listing:
                    updated += 1
                else:
                    listing = BusinessDirectoryListing()
                    created += 1

                listing.business_name = validated["business_name"]
                listing.location = validated["location"]
                listing.specialties = validated.get("specialties", [])
                listing.phone_number = validated.get("phone_number", "")
                listing.website = validated.get("website", "")
                listing.is_published = is_published
                listing.is_removed = is_removed
                listing.save()

            if errors:
                for error in errors:
                    self.stderr.write(self.style.ERROR(error))

            if options["dry_run"]:
                transaction.set_rollback(True)

        action = "Would import" if options["dry_run"] else "Imported"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} business directory listings: {created} created, {updated} updated, {skipped} skipped."
            )
        )

        if errors:
            raise CommandError(f"Import completed with {len(errors)} validation error(s).")

    def normalize_item(self, item, *, default_publish):
        normalized = {
            "business_name": item.get("business_name") or item.get("name_of_the_business") or item.get("name") or "",
            "location": item.get("location") or "",
            "specialties": item.get("specialties") or [],
            "phone_number": item.get("phone_number") or item.get("phone") or "",
            "website": item.get("website") or "",
            "is_published": item.get("is_published", default_publish),
            "is_removed": item.get("is_removed", False),
        }
        if isinstance(normalized["specialties"], str):
            normalized["specialties"] = [
                specialty.strip()
                for specialty in normalized["specialties"].split(",")
                if specialty.strip()
            ]
        return normalized
