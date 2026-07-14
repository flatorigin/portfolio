import base64
import json
import mimetypes
import uuid
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


def generate_text_with_image(*, feature, system_prompt, user_prompt, image_bytes, image_content_type):
    if not settings.OPENAI_API_KEY:
        raise AIServiceError("OPENAI_API_KEY is not configured.")

    model = resolve_model_name(feature)
    image_data = base64.b64encode(image_bytes).decode("ascii")
    image_url = f"data:{image_content_type};base64,{image_data}"
    body = {
        "model": model,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": user_prompt},
                    {"type": "input_image", "image_url": image_url},
                ],
            },
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
        with request.urlopen(req, timeout=45) as resp:
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


def _multipart_form_data(fields, files):
    boundary = f"----FlatOriginAI{uuid.uuid4().hex}"
    chunks = []
    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                str(value).encode("utf-8"),
                b"\r\n",
            ]
        )
    for name, filename, content_type, data in files:
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode("utf-8"),
                f"Content-Type: {content_type or 'application/octet-stream'}\r\n\r\n".encode("utf-8"),
                data,
                b"\r\n",
            ]
        )
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return boundary, b"".join(chunks)


def generate_image_from_image(*, feature, prompt, image_bytes, image_content_type, image_name="sketch.png"):
    if not settings.OPENAI_API_KEY:
        raise AIServiceError("OPENAI_API_KEY is not configured.")

    model = getattr(settings, "OPENAI_IMAGE_MODEL", "gpt-image-2").strip() or "gpt-image-2"
    content_type = image_content_type or mimetypes.guess_type(image_name)[0] or "image/png"
    boundary, body = _multipart_form_data(
        {"model": model, "prompt": prompt},
        [("image[]", image_name or "sketch.png", content_type, image_bytes)],
    )
    req = request.Request(
        "https://api.openai.com/v1/images/edits",
        data=body,
        headers={
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=90) as resp:
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

    image_base64 = None
    for item in payload.get("data") or []:
        if item.get("b64_json"):
            image_base64 = item["b64_json"]
            break
    if not image_base64:
        raise AIServiceError("No image was returned by the AI provider.")
    try:
        image_data = base64.b64decode(image_base64)
    except Exception as exc:
        raise AIServiceError(f"Could not decode generated image: {exc}")

    return {
        "image_bytes": image_data,
        "content_type": "image/png",
        "model": model,
    }
