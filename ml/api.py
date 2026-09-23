"""
Small FastAPI server that the React app calls.

Run:  uvicorn api:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
import os
from pathlib import Path
from typing import Literal

import httpx
import joblib
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from groq import Groq
from pydantic import BaseModel

load_dotenv(Path(__file__).parent / ".env")

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB")  # "Adam", a premade voice

# free tier: console.groq.com -- fast inference over open models, JSON mode
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

MODELS = Path(__file__).parent / "models"
task_bundle = joblib.load(MODELS / "task_time.joblib")
idle_bundle = joblib.load(MODELS / "idle_reason.joblib")
beh_bundle = joblib.load(MODELS / "behaviour.joblib")

app = FastAPI(title="Cat Operator Companion API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

CAT_COLS = ["task_type", "weather", "operator_skill", "soil"]
NUM_COLS = ["machine_age_yrs", "ambient_temp_c", "volume_m3", "planner_estimate_min"]
# "easy day" reference used to explain a prediction: what would it take on an ideal day?
BASELINE = {"weather": "Sunny", "operator_skill": "Expert", "soil": "Loam",
            "machine_age_yrs": 1, "ambient_temp_c": 30}
LABELS = {"weather": "Weather", "operator_skill": "Operator skill", "soil": "Soil",
          "machine_age_yrs": "Machine age", "ambient_temp_c": "Heat"}


class Task(BaseModel):
    task_type: str = "Trenching"
    weather: str = "Rainy"
    operator_skill: str = "Intermediate"
    soil: str = "Clay"
    machine_age_yrs: int = 4
    ambient_temp_c: float = 34
    volume_m3: float = 100
    planner_estimate_min: float = 45


def _predict(rows: list[dict]):
    X = pd.get_dummies(pd.DataFrame(rows)[CAT_COLS + NUM_COLS], columns=CAT_COLS, dtype=float)
    X = X.reindex(columns=task_bundle["columns"], fill_value=0.0)
    return {k: m.predict(X) for k, m in task_bundle["models"].items()}


@app.post("/predict/task")
def predict_task(task: Task):
    row = task.model_dump()
    # one prediction for the real task, plus one "what if this factor were ideal" per factor
    variants = [row] + [{**row, k: v} for k, v in BASELINE.items()]
    preds = _predict(variants)
    p50 = preds["p50"]
    reasons = []
    for i, key in enumerate(BASELINE, start=1):
        delta = float(p50[0] - p50[i])
        if abs(delta) >= 1:
            reasons.append({"factor": LABELS[key], "value": str(row[key]), "minutes": round(delta, 1)})
    reasons.sort(key=lambda r: -abs(r["minutes"]))
    p10, p90 = sorted([float(preds["p10"][0]), float(preds["p90"][0])])
    return {"p10": round(p10), "p50": round(float(p50[0])), "p90": round(p90),
            "planner_estimate": task.planner_estimate_min, "reasons": reasons[:3]}


class IdleWindow(BaseModel):
    mins_since_engine_start: float = 180
    mins_to_shift_end: float = 300
    hour_of_day: float = 10.2
    ambient_temp_c: float = 34
    next_truck_eta_min: float = 9
    hyd_oil_temp_c: float = 70
    engine_rpm: float = 1000
    seat_occupied: int = 1
    ac_on: int = 1


@app.post("/classify/idle")
def classify_idle(w: IdleWindow):
    X = pd.DataFrame([w.model_dump()])[idle_bundle["features"]]
    probs = idle_bundle["model"].predict_proba(X)[0]
    classes = idle_bundle["model"].classes_
    best = int(probs.argmax())
    return {"reason": classes[best], "confidence": round(float(probs[best]), 2),
            "all": {c: round(float(p), 2) for c, p in zip(classes, probs)}}


class HourStats(BaseModel):
    fuel_l: float = 3.8
    load_cycles: int = 2
    idle_min: float = 55
    seatbelt_off_min: float = 30
    harsh_swings: int = 1
    raised_bucket_travel: int = 0


@app.post("/score/behaviour")
def score_behaviour(h: HourStats):
    X = pd.DataFrame([h.model_dump()])[beh_bundle["features"]]
    model = beh_bundle["model"]
    unusual = bool(model.predict(X)[0] == -1)
    score = float(-model.score_samples(X)[0])  # higher = more unusual
    base = beh_bundle["baseline"]
    # readable rules sit next to the model, so every flag has a plain reason
    notes = []
    if h.idle_min > 40 and h.load_cycles <= 3:
        notes.append(f"Idle {h.idle_min:.0f} min with only {h.load_cycles} load cycles (usual {base['idle_min']:.0f} min)")
    if h.seatbelt_off_min > 5:
        notes.append(f"Seatbelt off for {h.seatbelt_off_min:.0f} min while engine running")
    if h.harsh_swings >= 5:
        notes.append(f"{h.harsh_swings} harsh swings this hour (usual {base['harsh_swings']:.0f})")
    if h.raised_bucket_travel >= 2:
        notes.append("Travelling with bucket raised")
    return {"unusual": unusual, "score": round(score, 3), "reasons": notes}


class SpeakRequest(BaseModel):
    text: str
    voice_id: str | None = None


@app.post("/speak")
def speak(req: SpeakRequest):
    """Text-to-speech via ElevenLabs. The key stays server-side; the frontend
    never sees it. Frontend falls back to the browser's own speech synthesis
    when this 503s (no key configured) or errors."""
    if not ELEVENLABS_API_KEY:
        raise HTTPException(503, "ELEVENLABS_API_KEY not set on the server")
    voice_id = req.voice_id or ELEVENLABS_VOICE_ID
    r = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={"xi-api-key": ELEVENLABS_API_KEY, "accept": "audio/mpeg", "content-type": "application/json"},
        json={
            "text": req.text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.8},
        },
        timeout=30,
    )
    if r.status_code != 200:
        raise HTTPException(502, f"ElevenLabs error: {r.text[:200]}")
    return Response(content=r.content, media_type="audio/mpeg")


class IncidentTranscript(BaseModel):
    transcript: str
    # context the frontend already computed -- the LLM must not guess any of this,
    # only reason over it (the models decide, the LLM only explains)
    machine_model: str
    machine_id: str
    operator_id: str
    machine_state: str  # e.g. "Working (swinging)" or "Stationary"
    min_dist_m: float  # real min operator-to-worker distance from the black box, last 60s
    location: str = "Zone B, Bay 2 (auto from machine position)"


class IncidentAssessment(BaseModel):
    """The only three fields Claude is allowed to decide, matching what the
    frontend's regex fallback currently guesses at."""
    category: Literal["Vehicle interaction", "Person in swing zone", "Other"]
    severity: Literal["Low", "Medium", "High"]
    suggested_action: str


@app.post("/structure/incident")
def structure_incident(req: IncidentTranscript):
    """Structures a voice-reported near-miss (Hindi/English/Hinglish transcript)
    into the same report shape the frontend's regex fallback produces. The LLM
    only fills in category/severity/suggested_action -- reasoning over the real
    transcript and the real black-box distance passed in, never inventing a
    fact of its own. type/location/machine/operator/machine_state are passed
    straight through unchanged. Frontend falls back to its own rule-based
    version when this 503s (no key configured) or 502s (the call failed or
    returned something that doesn't match the expected shape)."""
    if not GROQ_API_KEY:
        raise HTTPException(503, "GROQ_API_KEY not set on the server")

    client = Groq(api_key=GROQ_API_KEY)
    system = (
        "You are a mine-site safety reporting assistant. You are given the transcript of "
        "an excavator operator's spoken near-miss report (it may be in Hindi, English, or "
        "Hinglish) plus real sensor context: the machine's state and the minimum "
        "operator-to-worker distance measured by the machine's black box over the last 60 "
        "seconds. You must base severity on the REAL distance figure given to you -- never "
        "invent, guess, or adjust that number. Read the transcript to classify the incident "
        "category and to write one short, concrete suggested safety action for the site "
        "safety officer.\n\n"
        'Respond with ONLY a JSON object with exactly these keys: '
        '"category" (one of "Vehicle interaction", "Person in swing zone", "Other"), '
        '"severity" (one of "Low", "Medium", "High"), '
        '"suggested_action" (a short, concrete string). No other text, no markdown fences.'
    )
    user = (
        f'Transcript: "{req.transcript}"\n'
        f"Machine: {req.machine_model} ({req.machine_id})\n"
        f"Machine state at the time of the report: {req.machine_state}\n"
        f"Minimum distance to a worker in the last 60s, from the black box: {req.min_dist_m:.1f} m\n\n"
        "Classify this near-miss, assess its severity using the real distance above, and "
        "suggest one concrete corrective action."
    )

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=300,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        assessment = IncidentAssessment.model_validate_json(response.choices[0].message.content)
    except Exception as e:
        # Broad on purpose: auth errors, rate limits, network failures, and schema
        # validation should all just look like a 502 to the frontend, which has
        # its own rule-based fallback and must never crash on this call failing.
        raise HTTPException(502, f"Groq error: {str(e)[:200]}")

    return {
        "type": "Near-miss",
        "category": assessment.category,
        "severity": assessment.severity,
        "location": req.location,
        "machine": f"{req.machine_model} {req.machine_id}",
        "operator": req.operator_id,
        "machine_state": req.machine_state,
        "suggested_action": assessment.suggested_action,
    }


@app.get("/health")
def health():
    return {"ok": True}
