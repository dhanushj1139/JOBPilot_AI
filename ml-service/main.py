"""Resume-to-job similarity service.
Default: TF-IDF cosine similarity (no downloads). Set EMBED_MODEL (e.g. all-MiniLM-L6-v2) and install
sentence-transformers to use semantic embeddings instead."""
import os
from fastapi import FastAPI
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI(title="JobPilot ML")
_model = None


class MatchIn(BaseModel):
    resume: str
    job: str


def _embed_sim(a: str, b: str) -> float:
    global _model
    from sentence_transformers import SentenceTransformer, util
    if _model is None:
        _model = SentenceTransformer(os.environ["EMBED_MODEL"])
    e = _model.encode([a, b], convert_to_tensor=True)
    return float(util.cos_sim(e[0], e[1]))


def similarity(resume: str, job: str) -> float:
    if not resume.strip() or not job.strip():
        return 0.0
    if os.environ.get("EMBED_MODEL"):
        try:
            return max(0.0, min(1.0, _embed_sim(resume, job)))
        except Exception:
            pass  # fall back to TF-IDF
    vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
    try:
        m = vec.fit_transform([resume, job])
    except ValueError:
        return 0.0
    return float(cosine_similarity(m[0], m[1])[0][0])


@app.post("/match")
def match(body: MatchIn):
    return {"similarity": round(similarity(body.resume, body.job), 4)}


@app.get("/health")
def health():
    return {"ok": True}
