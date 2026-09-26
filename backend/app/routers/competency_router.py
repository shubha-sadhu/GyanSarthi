from __future__ import annotations

from fastapi import APIRouter

from app.competency.engine import compute_profile, generate_roadmap
from app.competency.framework import load_framework
from app.storage import get_storage

router = APIRouter(prefix="/competency", tags=["competency"])
_framework = load_framework()


@router.get("/framework")
def get_framework():
    return {
        "domains": [d.model_dump() for d in _framework.all_domains()],
        "roles": [r.model_dump() for r in _framework.roles.values()],
    }


@router.get("/profile/{user_id}")
def get_profile(user_id: str):
    profile = compute_profile(user_id, _framework)
    return profile.model_dump()


@router.get("/roadmap/{user_id}")
def get_roadmap(user_id: str, max_items: int = 5):
    roadmap = generate_roadmap(user_id, _framework, max_items=max_items)
    return roadmap.model_dump()


@router.get("/heatmap")
def get_heatmap():
    """
    Aggregate view across all users: average current_score per domain.
    Powers the 'competency heat-map' dashboard described in the proposal.
    """
    storage = get_storage()
    users = storage.users.all()

    totals: dict[str, list[float]] = {}
    for u in users:
        profile = compute_profile(u["user_id"], _framework)
        for d in profile.domain_scores:
            totals.setdefault(d.domain_id, []).append(d.current_score)

    heatmap = [
        {
            "domain_id": domain_id,
            "domain_name": _framework.domains[domain_id].name,
            "avg_score": round(sum(scores) / len(scores), 1),
            "num_users": len(scores),
        }
        for domain_id, scores in totals.items()
    ]
    return {"heatmap": sorted(heatmap, key=lambda h: h["avg_score"])}
