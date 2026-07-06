from django.contrib import admin, messages
from django.utils.html import format_html, format_html_join

from .models import (
    Project,
    ProjectImage,
    FeedbackTicket,
    FeedbackAttachment,
    FeedbackReply,
    PromotionSource,
    LocalPromotion,
    PromotionScrapeLog,
)
from .promotion_scraper import scrape_source

class ProjectImageInline(admin.TabularInline):
    model = ProjectImage
    extra = 0

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("title","owner","is_public","created_at")
    inlines = [ProjectImageInline]

@admin.register(ProjectImage)
class ProjectImageAdmin(admin.ModelAdmin):
    list_display = ("project", "media_type", "processing_status", "order", "created_at")


class FeedbackAttachmentInline(admin.TabularInline):
    model = FeedbackAttachment
    extra = 0
    fields = ("original_name", "content_type", "size", "uploaded_at", "download_link")
    readonly_fields = ("original_name", "content_type", "size", "uploaded_at", "download_link")
    can_delete = False

    def download_link(self, obj):
        if not obj or not obj.file:
            return "-"
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">Download</a>',
            obj.file.url,
        )

    download_link.short_description = "File"


class FeedbackReplyInline(admin.StackedInline):
    model = FeedbackReply
    extra = 0
    fields = ("author", "is_staff_reply", "message", "created_at", "notified_at")
    readonly_fields = ("created_at", "notified_at")


@admin.register(FeedbackTicket)
class FeedbackTicketAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "category", "subject", "status", "created_at", "updated_at")
    list_filter = ("category", "status", "created_at", "updated_at")
    search_fields = ("subject", "message", "user__username", "user__email")
    readonly_fields = ("user", "category", "subject", "message", "safe_links", "created_at", "updated_at", "resolved_notified_at")
    fields = (
        "user",
        "category",
        "subject",
        "message",
        "safe_links",
        "status",
        "internal_admin_note",
        "resolved_notified_at",
        "created_at",
        "updated_at",
    )
    inlines = [FeedbackAttachmentInline, FeedbackReplyInline]

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for instance in instances:
            if isinstance(instance, FeedbackReply) and instance.pk is None:
                if instance.author_id is None:
                    instance.author = request.user
                instance.is_staff_reply = True
                instance.save()
                instance.send_created_notification()
            else:
                instance.save()
        for obj in formset.deleted_objects:
            obj.delete()
        formset.save_m2m()

    def safe_links(self, obj):
        links = obj.links if isinstance(obj.links, list) else []
        if not links:
            return "-"
        return format_html_join(
            "",
            '<div><a href="{}" target="_blank" rel="noopener noreferrer">{}</a></div>',
            ((link, link) for link in links),
        )

    safe_links.short_description = "Links"


@admin.register(FeedbackAttachment)
class FeedbackAttachmentAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "reply", "original_name", "content_type", "size", "uploaded_at", "download_link")
    list_filter = ("content_type", "uploaded_at")
    search_fields = ("original_name", "ticket__subject", "ticket__user__username", "ticket__user__email")
    readonly_fields = ("ticket", "original_name", "content_type", "size", "uploaded_at", "download_link")

    def download_link(self, obj):
        if not obj or not obj.file:
            return "-"
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">Download</a>',
            obj.file.url,
        )

    download_link.short_description = "File"


@admin.register(FeedbackReply)
class FeedbackReplyAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "author", "is_staff_reply", "created_at", "notified_at")
    list_filter = ("is_staff_reply", "created_at", "notified_at")
    search_fields = ("message", "ticket__subject", "author__username", "author__email")
    readonly_fields = ("created_at", "notified_at")


class PromotionScrapeLogInline(admin.TabularInline):
    model = PromotionScrapeLog
    extra = 0
    fields = (
        "created_at",
        "status",
        "promotions_found",
        "promotions_added",
        "promotions_updated",
        "promotions_expired",
        "error",
    )
    readonly_fields = fields
    can_delete = False


@admin.register(PromotionSource)
class PromotionSourceAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "business_name",
        "category",
        "city",
        "state",
        "is_active",
        "paused_due_to_failures",
        "scrape_status",
        "last_scraped_at",
        "last_promotions_found",
    )
    list_filter = ("is_active", "paused_due_to_failures", "scrape_status", "category", "city", "state")
    search_fields = ("name", "business_name", "website_url", "category", "city", "state", "zip_code")
    readonly_fields = (
        "last_scraped_at",
        "last_successful_scrape_at",
        "last_promotions_found",
        "last_promotions_added",
        "last_promotions_updated",
        "last_promotions_expired",
        "scrape_status",
        "scrape_error",
        "consecutive_failures",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "Paste URL",
            {
                "description": "Only Website url is required. Save this source and FlatOrigin will scrape the page and fill business details when it can.",
                "fields": ("website_url", "is_active"),
            },
        ),
        (
            "Auto-filled business details",
            {
                "description": "Optional. Leave these blank if you want the scraper to infer them from the page.",
                "fields": (
                    "name",
                    "business_name",
                    "category",
                    "city",
                    "state",
                    "zip_code",
                    "service_radius_miles",
                    "refresh_interval_hours",
                ),
            },
        ),
        (
            "Scrape status",
            {
                "fields": (
                    "scrape_status",
                    "scrape_error",
                    "paused_due_to_failures",
                    "consecutive_failures",
                    "last_scraped_at",
                    "last_successful_scrape_at",
                    "last_promotions_found",
                    "last_promotions_added",
                    "last_promotions_updated",
                    "last_promotions_expired",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )
    actions = ("scrape_now", "resume_scheduled_scraping")
    inlines = [PromotionScrapeLogInline]

    def save_model(self, request, obj, form, change):
        is_new = obj.pk is None
        super().save_model(request, obj, form, change)
        if is_new and obj.is_active:
            result = scrape_source(obj, delay=False)
            self.message_user(
                request,
                f"Initial scrape finished: {result.status}, found {result.found}, added {result.added}.",
                messages.SUCCESS if result.status != PromotionSource.STATUS_FAILED else messages.WARNING,
            )

    @admin.action(description="Scrape now")
    def scrape_now(self, request, queryset):
        for source in queryset:
            result = scrape_source(source, delay=False)
            level = messages.SUCCESS if result.status != PromotionSource.STATUS_FAILED else messages.WARNING
            self.message_user(
                request,
                (
                    f"{source}: {result.status}. "
                    f"Found {result.found}, added {result.added}, updated {result.updated}, expired {result.expired}."
                ),
                level,
            )

    @admin.action(description="Resume scheduled scraping")
    def resume_scheduled_scraping(self, request, queryset):
        updated = queryset.update(paused_due_to_failures=False, consecutive_failures=0, scrape_error="")
        self.message_user(request, f"Resumed scheduled scraping for {updated} source(s).", messages.SUCCESS)


@admin.register(LocalPromotion)
class LocalPromotionAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "business_name",
        "category",
        "city",
        "admin_approved",
        "is_active",
        "applies_to_homeowners",
        "applies_to_contractors",
        "end_date",
        "updated_at",
    )
    list_filter = (
        "category",
        "city",
        "is_active",
        "admin_approved",
        "applies_to_homeowners",
        "applies_to_contractors",
        "end_date",
    )
    search_fields = (
        "title",
        "business_name",
        "category",
        "promotion_text",
        "product_or_service_name",
        "website_url",
    )
    readonly_fields = ("safe_website_link", "confidence_score", "raw_excerpt", "last_seen_at", "missing_since", "created_at", "updated_at")
    fields = (
        "source",
        "title",
        "business_name",
        "category",
        "promotion_text",
        "product_or_service_name",
        "original_price",
        "sale_price",
        "discount_text",
        "coupon_code",
        "start_date",
        "end_date",
        "website_url",
        "safe_website_link",
        "city",
        "state",
        "zip_code",
        "applies_to_homeowners",
        "applies_to_contractors",
        "is_active",
        "admin_approved",
        "confidence_score",
        "raw_excerpt",
        "last_seen_at",
        "missing_since",
        "created_at",
        "updated_at",
    )
    actions = ("approve_and_activate", "deactivate_promotions", "mark_unapproved")

    def safe_website_link(self, obj):
        if not obj.website_url:
            return "-"
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">{}</a>',
            obj.website_url,
            obj.website_url,
        )

    safe_website_link.short_description = "Website"

    @admin.action(description="Approve and activate")
    def approve_and_activate(self, request, queryset):
        updated = queryset.update(admin_approved=True, is_active=True)
        self.message_user(request, f"Approved and activated {updated} promotion(s).", messages.SUCCESS)

    @admin.action(description="Deactivate")
    def deactivate_promotions(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"Deactivated {updated} promotion(s).", messages.SUCCESS)

    @admin.action(description="Mark unapproved")
    def mark_unapproved(self, request, queryset):
        updated = queryset.update(admin_approved=False)
        self.message_user(request, f"Marked {updated} promotion(s) unapproved.", messages.SUCCESS)


@admin.register(PromotionScrapeLog)
class PromotionScrapeLogAdmin(admin.ModelAdmin):
    list_display = (
        "source",
        "status",
        "promotions_found",
        "promotions_added",
        "promotions_updated",
        "promotions_expired",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = ("source__name", "source__business_name", "source__website_url", "error")
    readonly_fields = (
        "source",
        "status",
        "promotions_found",
        "promotions_added",
        "promotions_updated",
        "promotions_expired",
        "error",
        "created_at",
    )
