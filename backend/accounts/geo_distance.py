from math import asin, cos, radians, sin, sqrt


EARTH_RADIUS_MILES = 3958.7613

COUNTRY_BOUNDS = {
    "CA": (41.0, 84.0, -142.0, -52.0),
    "MX": (14.0, 33.0, -119.0, -86.0),
    "US": (18.0, 72.0, -172.0, -66.0),
    "GB": (49.0, 61.0, -9.0, 2.5),
    "IE": (51.0, 56.0, -11.0, -5.0),
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
):
    if not origin:
        return items, {}

    origin_lat, origin_lng = origin
    origin_country = infer_country_code(origin_lat, origin_lng)
    distance_lookup = {}
    mapped_items = []
    unmapped_items = []

    for item in items:
        lat = lat_getter(item)
        lng = lng_getter(item)
        if lat is None or lng is None:
            unmapped_items.append(item)
            continue

        item_country = infer_country_code(lat, lng)
        if origin_country and item_country and item_country != origin_country:
            continue

        distance = haversine_miles(origin_lat, origin_lng, lat, lng)
        rounded_distance = round(distance, 1)
        distance_lookup[item.pk] = rounded_distance
        mapped_items.append((item, distance, fallback_key(item)))

    mapped_items.sort(key=lambda row: (row[1], row[2]))
    unmapped_items.sort(key=fallback_key)
    return [item for item, _, _ in mapped_items] + unmapped_items, distance_lookup
