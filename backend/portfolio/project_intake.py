import json
from functools import lru_cache
from pathlib import Path


TEMPLATE_PATH = Path(__file__).with_name("project_intake_templates.json")
READINESS_MAX_SCORE = 100


@lru_cache(maxsize=1)
def load_project_intake_templates():
    with TEMPLATE_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    project_types = payload.get("project_types") or []
    by_key = {item["key"]: item for item in project_types if isinstance(item, dict) and item.get("key")}
    payload["project_types_by_key"] = by_key
    return payload


def get_project_intake_template(project_type):
    if not project_type:
        return None
    return load_project_intake_templates()["project_types_by_key"].get(str(project_type).strip())


def get_project_type_choices():
    return [
        {"key": item["key"], "label": item.get("label") or item["key"].replace("_", " ").title()}
        for item in load_project_intake_templates().get("project_types", [])
    ]


def _normalize_answer(value):
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        cleaned = []
        for item in value:
            text = str(item or "").strip()
            if text:
                cleaned.append(text)
        return cleaned
    return value


def get_answered_question_count(template, guided_answers):
    if not template:
        return 0, 0
    questions = template.get("questions") or []
    answered = 0
    for question in questions:
        value = _normalize_answer((guided_answers or {}).get(question.get("id")))
        if isinstance(value, list) and value:
            answered += 1
        elif isinstance(value, str) and value:
            answered += 1
        elif value not in (None, "", []):
            answered += 1
    return answered, len(questions)


def iter_answer_lines(template, guided_answers):
    for question in (template or {}).get("questions") or []:
        value = _normalize_answer((guided_answers or {}).get(question.get("id")))
        if isinstance(value, list):
            rendered = ", ".join(value)
        else:
            rendered = str(value or "").strip()
        if rendered:
            yield f"- {question.get('question')}: {rendered}"


def summarize_markup_notes(markup_data):
    annotations = (markup_data or {}).get("annotations") or []
    lines = []
    for annotation in annotations[:12]:
        text = str(annotation.get("text") or annotation.get("label") or "").strip()
        annotation_type = str(annotation.get("type") or "").strip()
        if text and annotation_type:
            lines.append(f"- {annotation_type}: {text}")
        elif text:
            lines.append(f"- {text}")

    versions = (markup_data or {}).get("versions") or []
    for version in versions[:6]:
        version_name = str(version.get("name") or "").strip()
        if version_name:
            lines.append(f"- Saved markup: {version_name}")
    return lines


def calculate_project_readiness_score(plan, template=None, guided_answers=None, has_ai_summary=None):
    score = 0
    if str(getattr(plan, "project_type", "") or "").strip():
        score += 10
    if str(getattr(plan, "title", "") or "").strip() and str(getattr(plan, "title", "")).strip() != "Untitled issue":
        score += 10
    if str(getattr(plan, "house_location", "") or "").strip():
        score += 10
    if str(getattr(plan, "issue_summary", "") or "").strip():
        score += 15
    if getattr(plan, "budget_min", None) or getattr(plan, "budget_max", None):
        score += 10
    if getattr(plan, "images", None) is not None and plan.images.exists():
        score += 15

    answered, total = get_answered_question_count(template, guided_answers if guided_answers is not None else getattr(plan, "guided_answers_json", {}))
    if total:
        score += round((answered / total) * 20)

    if has_ai_summary is None:
        has_ai_summary = bool(getattr(plan, "contractor_ready_summary_json", {}))
    if has_ai_summary:
        score += 10

    return min(score, READINESS_MAX_SCORE)
