"""
Seeds short, original study notes into the Physics / Chemistry / Mathematics
domains (the "Testing" role) so `/quiz/generate` has something to work with
immediately. This is NOT a copy of any real JEE paper — real exam papers are
copyrighted — it's original explanatory content written for this demo, which
the RAG engine then turns into its own MCQs.

Needs real GEMINI_API_KEY and PINECONE_API_KEY in backend/.env (this goes
through the real ingestion pipeline: chunk -> embed -> upsert to Pinecone).

Run with:
    python -m scripts.seed_jee_content
"""
from __future__ import annotations

from app.competency.framework import load_framework
from app.ingestion.pipeline import ingest_transcript

NOTES = {
    "jee_physics": (
        "Newton's Second Law of Motion\n"
        "The net force on a body equals the rate of change of its momentum: "
        "F = dp/dt, which simplifies to F = ma for constant mass. This means "
        "acceleration is directly proportional to net force and inversely "
        "proportional to mass. In problems involving pulleys, inclined "
        "planes, or connected blocks, always draw a free body diagram for "
        "each mass separately, identify every force acting on it (gravity, "
        "normal reaction, tension, friction), resolve forces along and "
        "perpendicular to the direction of motion, then apply F = ma along "
        "the direction of motion for each body. Friction opposes relative "
        "motion or its tendency, and kinetic friction is generally less than "
        "the maximum static friction. On a frictionless incline of angle "
        "theta, the acceleration of a block sliding down is g sin(theta), "
        "independent of its mass."
    ),
    "jee_chemistry": (
        "Chemical Equilibrium and Le Chatelier's Principle\n"
        "A reversible reaction reaches equilibrium when the forward and "
        "reverse reaction rates become equal, at which point concentrations "
        "of reactants and products stop changing, though the reaction "
        "continues in both directions. The equilibrium constant Kc relates "
        "product and reactant concentrations at equilibrium for a given "
        "temperature. Le Chatelier's Principle states that if a system at "
        "equilibrium is subjected to a change in concentration, pressure, "
        "volume, or temperature, the equilibrium shifts to counteract that "
        "change. Increasing pressure on a gaseous equilibrium shifts it "
        "toward the side with fewer moles of gas. Adding more reactant "
        "shifts equilibrium toward products. Unlike concentration or "
        "pressure changes, a temperature change actually alters the value "
        "of Kc itself: increasing temperature favours the endothermic "
        "direction of the reaction."
    ),
    "jee_mathematics": (
        "Application of Derivatives: Maxima and Minima\n"
        "For a function f(x) that is differentiable on an interval, local "
        "maxima and minima occur at critical points where f'(x) = 0 or "
        "f'(x) is undefined. The first derivative test says: if f'(x) "
        "changes sign from positive to negative at a critical point, it is "
        "a local maximum; if it changes from negative to positive, it is a "
        "local minimum. The second derivative test offers a shortcut: if "
        "f''(x) < 0 at a critical point, it is a local maximum; if f''(x) > "
        "0, it is a local minimum; if f''(x) = 0, the test is inconclusive "
        "and the first derivative test must be used instead. For optimization "
        "word problems (maximizing area, minimizing cost, and similar), "
        "first express the quantity to optimize as a function of a single "
        "variable using any given constraints, then apply these tests to "
        "that single-variable function."
    ),
}

TITLES = {
    "jee_physics": "Physics — Newton's Second Law (demo notes)",
    "jee_chemistry": "Chemistry — Equilibrium & Le Chatelier's Principle (demo notes)",
    "jee_mathematics": "Mathematics — Maxima and Minima (demo notes)",
}


def seed():
    framework = load_framework()
    for domain_id, text in NOTES.items():
        print(f"Ingesting demo notes for {domain_id}...")
        doc = ingest_transcript(
            text,
            title=TITLES[domain_id],
            framework=framework,
            forced_domain_id=domain_id,  # skip LLM auto-tagging, we already know the domain
        )
        print(f"  -> {doc.num_chunks} chunk(s) indexed as '{doc.title}'")
    print("\nDone. Try /quiz/generate with domain_id=jee_physics, jee_chemistry, or jee_mathematics.")


if __name__ == "__main__":
    seed()
