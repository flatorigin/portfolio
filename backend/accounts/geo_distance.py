import re
from math import asin, cos, radians, sin, sqrt


EARTH_RADIUS_MILES = 3958.7613

COUNTRY_BOUNDS = {
    "US": (18.0, 72.0, -172.0, -66.0),
    "CA": (41.0, 84.0, -142.0, -52.0),
    "MX": (14.0, 33.0, -119.0, -86.0),
    "GB": (49.0, 61.0, -9.0, 2.5),
    "IE": (51.0, 56.0, -11.0, -5.0),
}

COUNTRY_ALIASES = {
    "US": "US",
    "USA": "US",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    "CA": "CA",
    "CAN": "CA",
    "CANADA": "CA",
    "MX": "MX",
    "MEXICO": "MX",
    "GB": "GB",
    "UK": "GB",
    "UNITED KINGDOM": "GB",
    "GREAT BRITAIN": "GB",
    "IE": "IE",
    "IRELAND": "IE",
}

US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
    "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
    "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
    "WI", "WY", "DC",
}

CANADIAN_PROVINCES = {
    "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
    "ALBERTA", "BRITISH COLUMBIA", "MANITOBA", "NEW BRUNSWICK", "NEWFOUNDLAND",
    "NEWFOUNDLAND AND LABRADOR", "NOVA SCOTIA", "NORTHWEST TERRITORIES", "NUNAVUT",
    "ONTARIO", "PRINCE EDWARD ISLAND", "QUEBEC", "SASKATCHEWAN", "YUKON",
}


def haversine_miles(lat1, lng1, lat2, lng2):
    lat1 = radians(float(lat1))
    lng1 = radians(float(lng1))
    lat2 = radians(float(lat2))
    lng2 = radians(float(lng2))

    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * asin(sqrt(a))


def parse_coordinate(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_country_code(value):
    text = str(value or "").strip().upper()
    if not text:
        return ""
    return COUNTRY_ALIASES.get(text, text[:2] if len(text) == 2 and text.isalpha() else "")


def infer_country_code_from_location(location):
    text = str(location or "").strip()
    if not text:
        return ""

    tokens = [
        token.strip().upper().rstrip(".")
        for token in re.split(r"[,;/|]", text)
        if token.strip()
    ]
    for token in reversed(tokens):
        if token in CANADIAN_PROVINCES:
            return "CA"
        if token in US_STATES:
            return "US"
        normalized = COUNTRY_ALIASES.get(token, "")
        if normalized:
            return normalized

    words = set(re.findall(r"[A-Za-z]+", text.upper()))
    if words & CANADIAN_PROVINCES:
        return "CA"
    if "CANADA" in words:
        return "CA"
    if "USA" in words or "UNITED" in words and "STATES" in words:
        return "US"
    return ""


def get_request_origin(request):
    lat = parse_coordinate(
        request.query_params.get("lat") or request.query_params.get("location_lat")
    )
    lng = parse_coordinate(
        request.query_params.get("lng") or request.query_params.get("location_lng")
    )
    if lat is not None and lng is not None:
        return lat, lng

    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        profile = getattr(user, "profile", None)
        if profile and profile.service_lat is not None and profile.service_lng is not None:
            return profile.service_lat, profile.service_lng

    return None


def get_request_country_code(request, origin=None):
    explicit = normalize_country_code(
        request.query_params.get("country_code") or request.query_params.get("country")
    )
    if explicit:
        return explicit

    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        profile = getattr(user, "profile", None)
        profile_country = infer_country_code_from_location(getattr(profile, "service_location", ""))
        if profile_country:
            return profile_country

    if origin:
        return infer_country_code(*origin) or ""
    return ""


def sort_by_distance(items, origin, lat_getter, lng_getter, fallback_key):
    if not origin:
        return items, {}

    origin_lat, origin_lng = origin
    distance_lookup = {}

    def sort_key(item):
        lat = lat_getter(item)
        lng = lng_getter(item)
        if lat is None or lng is None:
            return 1, None, fallback_key(item)
        distance = haversine_miles(origin_lat, origin_lng, lat, lng)
        distance_lookup[item.pk] = round(distance, 1)
        return 0, distance, fallback_key(item)

    return sorted(items, key=sort_key), distance_lookup


def infer_country_code(lat, lng):
    lat = parse_coordinate(lat)
    lng = parse_coordinate(lng)
    if lat is None or lng is None:
        return None

    for code, (min_lat, max_lat, min_lng, max_lng) in COUNTRY_BOUNDS.items():
        if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
            return code
    return None


def localized_distance_sort(
    items,
    origin,
    lat_getter,
    lng_getter,
    fallback_key,
    country_getter=None,
    origin_country_code="",
):
    if not origin:
        return items, {}

    origin_lat, origin_lng = origin
    origin_country = normalize_country_code(origin_country_code) or infer_country_code(origin_lat, origin_lng)
    distance_lookup = {}
    mapped_items = []
    unmapped_items = []

    for item in items:
        lat = lat_getter(item)
        lng = lng_getter(item)
        if lat is None or lng is None:
            unmapped_items.append(item)
            continue

        raw_country = country_getter(item) if country_getter else ""
        item_country = (
            normalize_country_code(raw_country)
            or infer_country_code_from_location(raw_country)
            or infer_country_code(lat, lng)
        )
        if origin_country and item_country and item_country != origin_country:
            continue

        distance = haversine_miles(origin_lat, origin_lng, lat, lng)
        rounded_distance = round(distance, 1)
        distance_lookup[item.pk] = rounded_distance
        mapped_items.append((item, distance, fallback_key(item)))

    mapped_items.sort(key=lambda row: (row[1], row[2]))
    unmapped_items.sort(key=fallback_key)
    return [item for item, _, _ in mapped_items] + unmapped_items, distance_lookup
