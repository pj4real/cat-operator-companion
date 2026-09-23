"""
Small FastAPI server that the React app calls.

Run:  uvicorn api:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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


@app.get("/health")
def health():
    return {"ok": True}
