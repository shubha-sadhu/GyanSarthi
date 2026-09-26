"""
Loads the Statistics-specific competency framework (domains, roles, and the
target proficiency each role should reach in each domain).

For the demo this reads app/data/sample_framework.json. Swap `load_framework`
for a MongoDB Atlas query later without touching the engine that consumes it.
"""
from __future__ import annotations

import json
import os

from app.models import CompetencyDomain, Role, RoleRequirement

_FRAMEWORK_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "sample_framework.json")


class CompetencyFramework:
    def __init__(
        self,
        domains: list[CompetencyDomain],
        roles: list[Role],
        requirements: list[RoleRequirement],
    ):
        self.domains = {d.domain_id: d for d in domains}
        self.roles = {r.role_id: r for r in roles}
        # (role_id, domain_id) -> target_level
        self.requirements: dict[tuple[str, str], int] = {
            (r.role_id, r.domain_id): int(r.target_level) for r in requirements
        }

    def target_level(self, role_id: str, domain_id: str) -> int:
        return self.requirements.get((role_id, domain_id), 2)  # default baseline target

    def domains_for_role(self, role_id: str) -> list[CompetencyDomain]:
        domain_ids = [d for (r, d) in self.requirements.keys() if r == role_id]
        return [self.domains[d] for d in domain_ids if d in self.domains]

    def all_domains(self) -> list[CompetencyDomain]:
        return list(self.domains.values())


def load_framework(path: str = _FRAMEWORK_PATH) -> CompetencyFramework:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    domains = [CompetencyDomain(**d) for d in raw["domains"]]
    roles = [Role(**r) for r in raw["roles"]]
    requirements = [RoleRequirement(**req) for req in raw["role_requirements"]]

    return CompetencyFramework(domains=domains, roles=roles, requirements=requirements)
