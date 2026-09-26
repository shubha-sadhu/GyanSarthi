"""
Classifies a piece of uploaded content against the competency framework's
domains, so ingested chunks are automatically routed to the right skill
area without a human tagging every upload.
"""
from __future__ import annotations

from app.competency.framework import CompetencyFramework
from app.llm_client import complete_json

_SYSTEM = (
    "You are a classifier for a government statistics training platform. "
    "Given a piece of training content and a list of competency domains, "
    "pick the single domain the content most helps build. Be decisive."
)


def tag_domain(text: str, framework: CompetencyFramework) -> str:
    domain_list = "\n".join(
        f"- {d.domain_id}: {d.name} — {d.description}"
        for d in framework.all_domains()
    )
    user = (
        f"Competency domains:\n{domain_list}\n\n"
        f"Content excerpt:\n\"\"\"\n{text[:2000]}\n\"\"\"\n\n"
        'Respond as JSON: {"domain_id": "<best matching domain_id>"}'
    )
    result = complete_json(_SYSTEM, user, max_tokens=200)
    domain_id = result.get("domain_id", "")
    if domain_id not in framework.domains:
        # Fall back to the first domain rather than failing ingestion outright.
        return next(iter(framework.domains))
    return domain_id
