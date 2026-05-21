import json
import os
from dataclasses import dataclass
from urllib.parse import urlencode
from urllib.request import urlopen


@dataclass(frozen=True)
class GeocodeResult:
    lat: float
    lng: float
    formatted_address: str = ""
    country_code: str = ""


class GeocodingError(Exception):
    pass


def get_google_maps_server_key():
    return (
        os.environ.get("GOOGLE_MAPS_API_KEY")
        or os.environ.get("VITE_GOOGLE_MAPS_API_KEY")
        or ""
    ).strip()


def geocode_with_google_maps(query, *, api_key=None, timeout=10):
    query = (query or "").strip()
    if not query:
        raise GeocodingError("Location query is required.")

    key = (api_key or get_google_maps_server_key()).strip()
    if not key:
        raise GeocodingError("GOOGLE_MAPS_API_KEY is not configured.")

    url = "https://maps.googleapis.com/maps/api/geocode/json?" + urlencode(
        {"address": query, "key": key}
    )
    with urlopen(url, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    status = payload.get("status")
    if status != "OK":
        message = payload.get("error_message") or status or "Unknown geocoding error"
        raise GeocodingError(message)

    results = payload.get("results") or []
    if not results:
        raise GeocodingError("No geocoding results found.")

    first = results[0]
    location = first.get("geometry", {}).get("location", {})
    try:
        lat = float(location["lat"])
        lng = float(location["lng"])
    except (KeyError, TypeError, ValueError) as exc:
        raise GeocodingError("Geocoding result did not include valid coordinates.") from exc

    country_code = ""
    for component in first.get("address_components", []):
        if "country" in component.get("types", []):
            country_code = str(component.get("short_name") or "").upper()
            break

    return GeocodeResult(
        lat=lat,
        lng=lng,
        formatted_address=first.get("formatted_address", ""),
        country_code=country_code,
    )
