from fastapi.testclient import TestClient
from main import app, similarity

c = TestClient(app)
RESUME = "Python developer with Django, PostgreSQL and Docker experience building REST APIs"


def test_related_job_scores_higher():
    good = similarity(RESUME, "Backend developer: Python, Django, PostgreSQL, REST API")
    bad = similarity(RESUME, "Hospital nurse needed for night shifts, patient care")
    assert good > bad and good > 0.2


def test_empty_text_is_zero():
    assert similarity("", "anything") == 0.0


def test_endpoint():
    r = c.post("/match", json={"resume": RESUME, "job": "Python Django developer"})
    assert r.status_code == 200 and 0 <= r.json()["similarity"] <= 1
