"""ML matching (TF-IDF + skill overlap), skill extraction, RAG explanation."""
import re, os, json, requests
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

MULTI = ["machine learning","deep learning","data science","data analysis","data engineering","computer vision","power bi",
 "spring boot","react native","project management","manual testing","rest api","project management"]
SINGLE = """python java javascript typescript c++ c# go golang rust ruby php swift kotlin scala r sql nosql mysql postgresql mongodb
redis oracle sqlite html css react angular vue node.js nodejs express django flask fastapi spring .net aws azure gcp docker
kubernetes terraform ansible jenkins git github gitlab ci/cd linux bash devops microservices graphql nlp pandas numpy
scikit-learn tensorflow pytorch keras llm rag langchain spark hadoop kafka airflow etl tableau excel statistics selenium testing
qa automation junit pytest agile scrum jira figma android ios flutter salesforce sap servicenow cybersecurity networking
blockchain embedded iot matlab communication leadership""".split()
ALL = sorted(set(MULTI) | set(SINGLE), key=lambda x: -len(x))

def has(text, skill):
    return re.search(r"(?<![\w+#.])" + re.escape(skill) + r"(?![\w+#])", text, re.I) is not None

def llm(prompt, max_tokens=700):
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key: return None
    try:
        r = requests.post("https://api.anthropic.com/v1/messages", timeout=60,
            headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5"), "max_tokens": max_tokens,
                  "messages": [{"role": "user", "content": prompt}]})
        return r.json()["content"][0]["text"]
    except Exception as e:
        print("LLM error", e); return None

def extract_skills(resume_text):
    found = [s for s in ALL if has(resume_text, s)]
    out = llm("Extract the professional skills (technologies, tools, domains, soft skills) from this resume. "
              "Return ONLY a JSON array of short lowercase strings.\n\n" + resume_text[:8000])
    if out:
        try:
            arr = json.loads(out[out.index("["): out.rindex("]") + 1])
            found += [str(x).lower().strip() for x in arr]
        except Exception: pass
    return sorted(set(found))

def score_jobs(user, jobs):
    """Return [(job, score 0-100, matched_skills)] sorted desc."""
    if not jobs: return []
    skills = json.loads(user["skills"] or "[]")
    profile = f"{user['job_title'] or ''} {user['job_title'] or ''} {' '.join(skills)} {(user['resume_text'] or '')[:4000]}"
    docs = [f"{j['title']} {j['title']} {j['description'] or ''}" for j in jobs]
    try:
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=30000)
        m = vec.fit_transform([profile] + docs)
        sims = cosine_similarity(m[0:1], m[1:])[0]
    except ValueError:
        sims = [0] * len(jobs)
    title_words = {w for w in re.findall(r"\w+", (user["job_title"] or "").lower()) if len(w) > 2}
    out = []
    for j, sim in zip(jobs, sims):
        text = f"{j['title']} {j['description'] or ''}"
        matched = [s for s in skills if has(text, s)]
        overlap = len(matched) / max(1, min(len(skills), 8))
        tb = 1.0 if title_words & set(re.findall(r"\w+", j["title"].lower())) else 0
        s = 100 * (0.35 * min(1, sim * 2.5) + 0.40 * min(1, overlap) + 0.25 * tb)
        out.append((j, round(s, 1), matched))
    return sorted(out, key=lambda x: -x[1])

def explain(user, job):
    """RAG: retrieve most relevant resume chunks for this job, then ask LLM for fit + gaps."""
    resume = user["resume_text"] or ""
    chunks = [c.strip() for c in re.split(r"\n{2,}|(?<=\.)\s{2,}", resume) if len(c.strip()) > 30] or [resume]
    try:
        vec = TfidfVectorizer(stop_words="english").fit(chunks + [job["description"] or ""])
        sims = cosine_similarity(vec.transform([job["description"] or ""]), vec.transform(chunks))[0]
        top = [chunks[i] for i in sims.argsort()[::-1][:4]]
    except ValueError:
        top = chunks[:3]
    ans = llm(f"Job: {job['title']} at {job['company']}\n{(job['description'] or '')[:3000]}\n\n"
              f"Relevant parts of the candidate's resume:\n" + "\n---\n".join(top) +
              "\n\nIn under 120 words: why the candidate fits, the main skill gaps, and one tip for the application.")
    return ans or ("Set ANTHROPIC_API_KEY to enable AI explanations. Relevant resume sections found:\n- " + "\n- ".join(c[:200] for c in top))
