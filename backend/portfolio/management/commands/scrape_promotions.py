from django.core.management.base import BaseCommand

from portfolio.models import PromotionSource
from portfolio.promotion_scraper import scrape_due_sources, scrape_source


class Command(BaseCommand):
    help = "Scrape due Local Promotion sources."

    def add_arguments(self, parser):
        parser.add_argument("--source-id", type=int, default=None, help="Scrape a single PromotionSource ID.")
        parser.add_argument("--all", action="store_true", help="Scrape every active source regardless of interval.")
        parser.add_argument("--no-delay", action="store_true", help="Skip randomized delay between requests.")

    def handle(self, *args, **options):
        source_id = options.get("source_id")
        no_delay = options.get("no_delay")

        if source_id:
            source = PromotionSource.objects.get(pk=source_id)
            result = scrape_source(source, delay=not no_delay)
            self.stdout.write(
                self.style.SUCCESS(
                    f"{source.id}: {result.status} found={result.found} added={result.added} "
                    f"updated={result.updated} expired={result.expired}"
                )
            )
            return

        if options.get("all"):
            results = []
            queryset = PromotionSource.objects.filter(is_active=True, paused_due_to_failures=False).order_by("id")
            for source in queryset:
                results.append((source.id, scrape_source(source, delay=not no_delay)))
        else:
            results = scrape_due_sources()

        if not results:
            self.stdout.write("No promotion sources due for scraping.")
            return

        for source_id, result in results:
            self.stdout.write(
                f"{source_id}: {result.status} found={result.found} added={result.added} "
                f"updated={result.updated} expired={result.expired}"
            )
