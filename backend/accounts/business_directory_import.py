import json
from dataclasses import dataclass, field

from django.db import transaction

from accounts.models import BusinessDirectoryListing
from accounts.serializers import BusinessDirectoryListingSerializer


@dataclass
class BusinessDirectoryImportResult:
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    dry_run: bool = False

    @property
    def ok(self):
        return not self.errors

    @property
    def action_label(self):
        return "Would import" if self.dry_run else "Imported"

    def summary(self):
        return (
            f"{self.action_label} business directory listings: "
            f"{self.created} created, {self.updated} updated, {self.skipped} skipped."
        )


def parse_business_directory_json(raw):
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON: {exc}") from exc

    if not isinstance(payload, list):
        raise ValueError("Expected the JSON file to contain a list of business listings.")

    return payload


def normalize_business_directory_item(item, *, default_publish):
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


def import_business_directory_payload(payload, *, default_publish=False, dry_run=False):
    result = BusinessDirectoryImportResult(dry_run=dry_run)

    with transaction.atomic():
        for index, raw_item in enumerate(payload, start=1):
            if not isinstance(raw_item, dict):
                result.errors.append(f"Item {index}: expected an object.")
                result.skipped += 1
                continue

            item = normalize_business_directory_item(raw_item, default_publish=default_publish)
            serializer = BusinessDirectoryListingSerializer(data=item)
            if not serializer.is_valid():
                result.errors.append(f"Item {index}: {serializer.errors}")
                result.skipped += 1
                continue

            validated = dict(serializer.validated_data)
            is_published = bool(item.get("is_published", False))
            is_removed = bool(item.get("is_removed", False))

            listing = BusinessDirectoryListing.objects.filter(
                business_name__iexact=validated["business_name"],
                location__iexact=validated["location"],
            ).first()
            if listing:
                result.updated += 1
            else:
                listing = BusinessDirectoryListing()
                result.created += 1

            listing.business_name = validated["business_name"]
            listing.location = validated["location"]
            listing.specialties = validated.get("specialties", [])
            listing.phone_number = validated.get("phone_number", "")
            listing.website = validated.get("website", "")
            listing.is_published = is_published
            listing.is_removed = is_removed
            listing.save()

        if dry_run or result.errors:
            transaction.set_rollback(True)

    return result
