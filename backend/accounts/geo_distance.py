from math import asin, cos, radians, sin, sqrt


EARTH_RADIUS_MILES = 3958.7613


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
