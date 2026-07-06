import hashlib
import random
import re
import time
from dataclasses import dataclass
from datetime import datetime
from html import unescape
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import LocalPromotion, PromotionScrapeLog, PromotionSource


PROMOTION_SIGNALS = (
    "sale",
    "discount",
    "promotion",
    "special",
    "coupon",
    "offer",
    "clearance",
    "limited time",
    "save",
    "percent off",
    "% off",
    "free estimate",
    "seasonal special",
    "contractor discount",
    "homeowner special",
)

PRICE_RE = re.compile(r"\$\s?\d[\d,]*(?:\.\d{2})?")
PERCENT_RE = re.compile(r"\b\d{1,2}\s?%\s?off\b", re.IGNORECASE)
SAVE_RE = re.compile(r"\bsave\s+(?:\$\s?\d[\d,]*(?:\.\d{2})?|\d{1,2}\s?%)\b", re.IGNORECASE)
COUPON_RE = re.compile(
    r"\b(?:coupon\s+code|promo\s+code|coupon|code)\s*:?\s*([A-Z0-9][A-Z0-9_-]{2,20})\b",
    re.IGNORECASE,
)
DATE_RE = re.compile(
    r"\b(?:expires?|valid through|ends?)\s*:?\s*"
    r"([A-Z][a-z]{2,8}\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}/\d{1,2}/\d{2,4})",
    re.IGNORECASE,
)
LOCATION_RE = re.compile(
    r"\b([A-Z][A-Za-z .'-]{2,60}),?\s+"
    r"(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)"
    r"\s+(\d{5}(?:-\d{4})?)\b"
)

CATEGORY_KEYWORDS = (
    ("Lumber & Materials", ("lumber", "plywood", "deck board", "framing", "drywall", "concrete", "cement", "insulation", "siding")),
    ("Tools & Equipment", ("tool", "drill", "saw", "rental", "equipment", "ladder", "compressor", "nailer")),
    ("Roofing", ("roof", "shingle", "gutter", "flashing")),
    ("Landscaping", ("landscape", "mulch", "gravel", "stone", "paver", "tree", "soil")),
    ("Flooring", ("flooring", "tile", "hardwood", "vinyl", "carpet")),
    ("Paint", ("paint", "primer", "stain", "brush", "roller")),
    ("Plumbing", ("plumbing", "pipe", "faucet", "water heater", "drain")),
    ("Electrical", ("electrical", "wire", "breaker", "lighting", "outlet")),
    ("Windows & Doors", ("window", "door", "trim", "molding")),
    ("Contractor Services", ("handyman", "contractor", "installation", "repair", "remodel", "free estimate")),
)


class PromotionScrapeError(Exception):
    pass


@dataclass
class ScrapeResult:
    status: str
    found: int = 0
    added: int = 0
    updated: int = 0
    expired: int = 0
    error: str = ""


def normalize_space(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def canonical_fingerprint(source_id, title, promotion_text, product_or_service_name):
    raw = "|".join(
        [
            str(source_id),
            normalize_space(title).lower(),
            normalize_space(product_or_service_name).lower(),
            normalize_space(promotion_text).lower(),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def promotion_source_key(source_id, title, product_or_service_name, raw_excerpt):
    base = normalize_space(product_or_service_name) or normalize_space(title) or normalize_space(raw_excerpt)
    base = PRICE_RE.sub("", base)
    base = PERCENT_RE.sub("", base)
    base = SAVE_RE.sub("", base)
    base = re.sub(r"\b(?:sale|discount|promotion|special|coupon|offer|clearance|limited time|save)\b", "", base, flags=re.IGNORECASE)
    base = normalize_space(base).lower()[:120]
    raw = f"{source_id}|{base}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:40]


def can_fetch_url(url):
    if not getattr(settings, "PROMOTIONS_RESPECT_ROBOTS_TXT", True):
        return True

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return False

    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = RobotFileParser()
    parser.set_url(robots_url)
    try:
        parser.read()
    except Exception:
        return True
    return parser.can_fetch(getattr(settings, "PROMOTIONS_USER_AGENT", "FlatOriginBot/1.0"), url)


def fetch_page_text(url):
    if not can_fetch_url(url):
        raise PromotionScrapeError("robots.txt does not allow scraping this URL.")

    headers = {
        "User-Agent": getattr(settings, "PROMOTIONS_USER_AGENT", "FlatOriginBot/1.0"),
        "Accept": "text/html,application/xhtml+xml",
    }
    timeout = int(getattr(settings, "PROMOTIONS_SCRAPE_TIMEOUT_SECONDS", 12))
    response = requests.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
        raise PromotionScrapeError("Source did not return an HTML page.")

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "img", "picture", "video", "audio", "iframe"]):
        tag.decompose()

    blocks = []
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "p", "li", "td", "span", "div", "a"]):
        text = normalize_space(unescape(tag.get_text(" ", strip=True)))
        if not text or len(text) < 12:
            continue
        if len(text) > 600:
            continue
        if text.lower() in {item.lower() for item in blocks[-5:]}:
            continue
        blocks.append(text)

    return blocks


def source_name_from_url(url):
    parsed = urlparse(url)
    host = parsed.netloc.lower().split("@")[-1].split(":")[0]
    host = re.sub(r"^www\.", "", host)
    root = host.split(".")[0] if host else "Promotion source"
    words = re.split(r"[-_]+", root)
    return " ".join(word.capitalize() for word in words if word) or host or "Promotion source"


def infer_source_details(source, blocks):
    text = "\n".join(blocks[:80])
    updates = {}
    fallback_name = source_name_from_url(source.website_url)

    if not source.name:
        updates["name"] = fallback_name
    if not source.business_name:
        updates["business_name"] = fallback_name

    if not source.category:
        lower = text.lower()
        for category, keywords in CATEGORY_KEYWORDS:
            if any(keyword in lower for keyword in keywords):
                updates["category"] = category
                break

    if not (source.city and source.state and source.zip_code):
        match = LOCATION_RE.search(text)
        if match:
            city, state, zip_code = match.groups()
            if not source.city:
                updates["city"] = normalize_space(city)
            if not source.state:
                updates["state"] = state
            if not source.zip_code:
                updates["zip_code"] = zip_code

    if updates:
        for field, value in updates.items():
            setattr(source, field, value)
        source.save(update_fields=[*updates.keys(), "updated_at"])
    return source


def block_has_signal(text):
    lower = text.lower()
    return any(signal in lower for signal in PROMOTION_SIGNALS) or bool(PRICE_RE.search(text) and SAVE_RE.search(text))


def title_from_block(block):
    cleaned = normalize_space(block)
    parts = re.split(r"[.!?]", cleaned, maxsplit=1)
    title = parts[0].strip(" -:|")
    if len(title) > 90:
        title = title[:87].rstrip() + "..."
    return title or "Local promotion"


def detect_product_or_service(block, source):
    text = normalize_space(block)
    before_dash = re.split(r"\s[-–|]\s", text, maxsplit=1)[0].strip()
    if before_dash and len(before_dash) <= 80 and not block_has_signal(before_dash):
        return before_dash
    if source.category:
        return source.category
    return ""


def parse_optional_date(value):
    if not value:
        return None
    raw = value.strip()
    formats = ("%m/%d/%Y", "%m/%d/%y", "%B %d, %Y", "%b %d, %Y", "%B %d", "%b %d")
    for fmt in formats:
        try:
            parsed = datetime.strptime(raw, fmt)
            if "%Y" not in fmt and "%y" not in fmt:
                parsed = parsed.replace(year=timezone.now().year)
            return parsed.date()
        except ValueError:
            continue
    return None


def extract_promotions_from_blocks(source, blocks):
    promotions = []
    seen = set()
    for index, block in enumerate(blocks):
        if not block_has_signal(block):
            continue

        context_parts = [block]
        if index + 1 < len(blocks) and len(blocks[index + 1]) < 240:
            next_block = blocks[index + 1]
            if not next_block.lower().startswith(("privacy", "terms", "copyright")):
                context_parts.append(next_block)
        text = normalize_space(" ".join(context_parts))
        if len(text) > 700:
            text = text[:697].rstrip() + "..."

        prices = PRICE_RE.findall(text)
        discount_match = PERCENT_RE.search(text) or SAVE_RE.search(text)
        coupon_match = COUPON_RE.search(text)
        date_match = DATE_RE.search(text)
        confidence = 0.35
        confidence += 0.15 if discount_match else 0
        confidence += 0.15 if prices else 0
        confidence += 0.1 if coupon_match else 0
        confidence += 0.1 if "contractor" in text.lower() or "homeowner" in text.lower() else 0
        confidence = min(confidence, 0.95)

        title = title_from_block(block)
        product_or_service_name = detect_product_or_service(block, source)
        source_key = promotion_source_key(source.id or "new", title, product_or_service_name, block)
        fingerprint = canonical_fingerprint(source.id or "new", title, text, product_or_service_name)
        if source_key in seen:
            continue
        seen.add(source_key)

        promotions.append(
            {
                "title": title,
                "business_name": source.business_name or source.name,
                "category": source.category,
                "promotion_text": text,
                "product_or_service_name": product_or_service_name,
                "original_price": prices[0] if len(prices) > 1 else "",
                "sale_price": prices[-1] if prices else "",
                "discount_text": discount_match.group(0) if discount_match else "",
                "coupon_code": coupon_match.group(1).upper() if coupon_match else "",
                "end_date": parse_optional_date(date_match.group(1)) if date_match else None,
                "website_url": source.website_url,
                "city": source.city,
                "state": source.state,
                "zip_code": source.zip_code,
                "applies_to_homeowners": "contractor discount" not in text.lower(),
                "applies_to_contractors": "homeowner special" not in text.lower(),
                "confidence_score": round(confidence, 2),
                "raw_excerpt": block,
                "source_key": source_key,
                "content_fingerprint": fingerprint,
            }
        )
    return promotions


def scrape_source(source, *, delay=True):
    if delay:
        low = float(getattr(settings, "PROMOTIONS_SCRAPE_DELAY_MIN_SECONDS", 0.5))
        high = float(getattr(settings, "PROMOTIONS_SCRAPE_DELAY_MAX_SECONDS", 2.0))
        if high > 0:
            time.sleep(random.uniform(max(0, low), max(low, high)))

    now = timezone.now()
    try:
        blocks = fetch_page_text(source.website_url)
        source = infer_source_details(source, blocks)
        promotion_data = extract_promotions_from_blocks(source, blocks)
    except Exception as exc:
        error = str(exc)
        with transaction.atomic():
            source.last_scraped_at = now
            source.scrape_status = PromotionSource.STATUS_FAILED
            source.scrape_error = error[:2000]
            source.consecutive_failures += 1
            if source.consecutive_failures >= int(getattr(settings, "PROMOTIONS_MAX_CONSECUTIVE_FAILURES", 5)):
                source.paused_due_to_failures = True
            source.save(update_fields=[
                "last_scraped_at",
                "scrape_status",
                "scrape_error",
                "consecutive_failures",
                "paused_due_to_failures",
                "updated_at",
            ])
            PromotionScrapeLog.objects.create(source=source, status=source.scrape_status, error=error[:4000])
        return ScrapeResult(status=PromotionSource.STATUS_FAILED, error=error)

    found = len(promotion_data)
    added = 0
    updated = 0
    expired = 0
    seen_keys = {item["source_key"] for item in promotion_data}
    status = PromotionSource.STATUS_SUCCESS if found else PromotionSource.STATUS_NO_PROMOTIONS_FOUND

    with transaction.atomic():
        for item in promotion_data:
            promotion = LocalPromotion.objects.filter(source=source, source_key=item["source_key"]).first()
            if promotion:
                changed = False
                for field, value in item.items():
                    if getattr(promotion, field) != value:
                        setattr(promotion, field, value)
                        changed = True
                promotion.last_seen_at = now
                promotion.missing_since = None
                if changed:
                    promotion.save()
                    updated += 1
                else:
                    promotion.save(update_fields=["last_seen_at", "missing_since", "updated_at"])
            else:
                LocalPromotion.objects.create(
                    source=source,
                    is_active=False,
                    admin_approved=False,
                    last_seen_at=now,
                    **item,
                )
                added += 1

        stale = LocalPromotion.objects.filter(source=source, is_active=True).exclude(
            source_key__in=seen_keys
        )
        expired = stale.count()
        stale.update(is_active=False, missing_since=now)

        source.last_scraped_at = now
        source.last_successful_scrape_at = now if found else source.last_successful_scrape_at
        source.last_promotions_found = found
        source.last_promotions_added = added
        source.last_promotions_updated = updated
        source.last_promotions_expired = expired
        source.scrape_status = status
        source.scrape_error = ""
        source.consecutive_failures = 0
        source.paused_due_to_failures = False
        source.save()
        PromotionScrapeLog.objects.create(
            source=source,
            status=status,
            promotions_found=found,
            promotions_added=added,
            promotions_updated=updated,
            promotions_expired=expired,
        )

    return ScrapeResult(status=status, found=found, added=added, updated=updated, expired=expired)


def scrape_due_sources():
    results = []
    for source in PromotionSource.objects.filter(is_active=True, paused_due_to_failures=False).order_by("id"):
        if source.should_scrape:
            results.append((source.id, scrape_source(source)))
    return results
