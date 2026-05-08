from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from accounts.business_directory_import import (
    import_business_directory_payload,
    parse_business_directory_json,
)


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
            payload = parse_business_directory_json(path.read_text(encoding="utf-8"))
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        result = import_business_directory_payload(
            payload,
            default_publish=options["publish"],
            dry_run=options["dry_run"],
        )

        for error in result.errors:
            self.stderr.write(self.style.ERROR(error))

        self.stdout.write(self.style.SUCCESS(result.summary()))

        if result.errors:
            raise CommandError(f"Import completed with {len(result.errors)} validation error(s).")
