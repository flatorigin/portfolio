import json
from urllib import error, request

from django.conf import settings


FEATURE_MODEL_MAP = {
    "project_summary": "primary",
    "project_checklist": "light",
    "bid_proposal": "primary",
    "profile_headline": "primary",
    "profile_blurb": "primary",
    "profile_bio": "primary",
    "planner_analyze": "primary",
    "planner_options": "primary",
    "planner_draft": "primary",
}


class AIServiceError(Exception):
    pass


def resolve_model_name(feature):
    variant = FEATURE_MODEL_MAP.get(feature, "primary")
    if variant == "light":
        return settings.OPENAI_MODEL_LIGHT
    return settings.OPENAI_MODEL_PRIMARY


def _extract_output_text(payload):
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    output = payload.get("output") or []
    chunks = []
    for item in output:
        for content in item.get("content") or []:
            if content.get("type") == "output_text" and content.get("text"):
                chunks.append(content["text"])
    text = "\n".join(chunk.strip() for chunk in chunks if chunk and chunk.strip()).strip()
    if text:
        return text
    raise AIServiceError("No text was returned by the AI provider.")


def generate_text(*, feature, system_prompt, user_prompt):
    if not settings.OPENAI_API_KEY:
        raise AIServiceError("OPENAI_API_KEY is not configured.")

    model = resolve_model_name(feature)
    body = {
        "model": model,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
            {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
        ],
    }

    req = request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
            message = (
                parsed.get("error", {}).get("message")
                or parsed.get("message")
                or raw
            )
        except Exception:
            message = raw or str(exc)
        raise AIServiceError(message)
    except Exception as exc:
        raise AIServiceError(str(exc))

    return {
        "text": _extract_output_text(payload),
        "model": payload.get("model") or model,
    }
