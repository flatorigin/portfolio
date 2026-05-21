from django.core.management.base import BaseCommand, CommandError

from accounts.geocoding import GeocodingError, geocode_with_google_maps
from accounts.models import BusinessDirectoryListing


class Command(BaseCommand):
    help = "Backfill latitude/longitude for business directory listings from their location text."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be geocoded without saving changes.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-geocode listings that already have coordinates.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Maximum number of listings to process.",
        )
        parser.add_argument(
            "--id",
            dest="listing_ids",
            type=int,
            action="append",
            default=[],
            help="Only geocode a specific listing id. Can be passed multiple times.",
        )

    def handle(self, *args, **options):
        qs = BusinessDirectoryListing.objects.exclude(location="")
        if options["listing_ids"]:
            qs = qs.filter(id__in=options["listing_ids"])
        if not options["force"]:
            qs = qs.filter(location_lat__isnull=True, location_lng__isnull=True)
        qs = qs.order_by("business_name", "id")
        if options["limit"] and options["limit"] > 0:
            qs = qs[: options["limit"]]

        processed = 0
        updated = 0
        skipped = 0
        errors = []

        for listing in qs:
            processed += 1
            try:
                result = geocode_with_google_maps(listing.location)
            except GeocodingError as exc:
                errors.append(f"{listing.id} {listing.business_name}: {exc}")
                skipped += 1
                continue

            self.stdout.write(
                f"{listing.business_name}: {listing.location} -> "
                f"{result.lat:.6f}, {result.lng:.6f}"
            )
            if not options["dry_run"]:
                listing.location_lat = result.lat
                listing.location_lng = result.lng
                listing.save(update_fields=["location_lat", "location_lng", "updated_at"])
            updated += 1

        for error in errors:
            self.stderr.write(self.style.ERROR(error))

        action = "Would update" if options["dry_run"] else "Updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} business directory geocodes: "
                f"{updated} updated, {skipped} skipped, {processed} processed."
            )
        )

        if errors:
            raise CommandError(f"Geocoding completed with {len(errors)} error(s).")
