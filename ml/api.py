"""
Small FastAPI server that the React app calls.

Run:  uvicorn api:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
import json
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
DATA = Path(__file__).parent / "data"
task_bundle = joblib.load(MODELS / "task_time.joblib")
idle_bundle = joblib.load(MODELS / "idle_reason.joblib")
beh_bundle = joblib.load(MODELS / "behaviour.joblib")
health_bundle = joblib.load(MODELS / "machine_health.joblib")
fuel_bundle = joblib.load(MODELS / "fuel_rate.joblib")

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


# ---------------------------------------------------------------- machine health risk
HEALTHY = {"hyd_oil_temp_max": 79, "coolant_temp_max": 88, "engine_load_pct": 62, "hrs_since_oil_change": 250,
           "sos_iron_ppm": 17, "sos_silicon_ppm": 8, "sos_soot_pct": 0.7, "sos_water_pct": 0.04,
           "idle_pct": 30, "fault_codes_7d": 0}
# factor -> (plain label, unit, component, what to do about it)
HEALTH_TEXT = {
    "sos_silicon_ppm": ("Silicon in oil", "ppm", "Engine air intake", "Check air filter and intake hoses: dust is getting into the engine"),
    "sos_iron_ppm": ("Iron in oil", "ppm", "Engine wear", "Wear metals rising: resample oil at next service"),
    "sos_water_pct": ("Water in oil", "%", "Cooling system", "Coolant may be leaking into oil: check oil cooler and head gasket"),
    "coolant_temp_max": ("Coolant peak", "°C", "Cooling system", "Clean radiator core and check coolant level"),
    "hyd_oil_temp_max": ("Hydraulic oil peak", "°C", "Hydraulics", "Clean hydraulic oil cooler, check oil level"),
    "hrs_since_oil_change": ("Hours since oil change", "h", "Engine oil", "Oil change overdue: book service"),
    "sos_soot_pct": ("Soot in oil", "%", "Engine oil", "Oil change overdue: book service"),
    "fault_codes_7d": ("Fault codes, last 7 days", "", "Electronics", "Ask dealer for a remote troubleshoot"),
    "engine_load_pct": ("Engine load", "%", "Engine", "Check for dragging brakes or wrong work mode"),
    "idle_pct": ("Idle share", "%", "Engine", "Long idling: see idle reasons"),
}


class HealthDay(BaseModel):
    hyd_oil_temp_max: float = 79
    coolant_temp_max: float = 88
    engine_load_pct: float = 62
    hrs_since_oil_change: float = 210
    sos_iron_ppm: float = 29
    sos_silicon_ppm: float = 24
    sos_soot_pct: float = 0.7
    sos_water_pct: float = 0.04
    idle_pct: float = 30
    fault_codes_7d: float = 1
    machine_age_yrs: float = 4


def _health(row: dict):
    feats = health_bundle["features"]
    # one score for today, plus one per factor with that factor put back to a healthy value
    variants = [row] + [{**row, k: v} for k, v in HEALTHY.items()]
    probs = health_bundle["model"].predict_proba(pd.DataFrame(variants)[feats])[:, 1]
    risk = float(probs[0])
    reasons = []
    for i, key in enumerate(HEALTHY, start=1):
        pts = (risk - float(probs[i])) * 100
        if pts >= 3:
            label, unit, comp, action = HEALTH_TEXT[key]
            reasons.append({"factor": label, "value": f"{row[key]:g}{(' ' + unit) if unit else ''}",
                            "usual": f"{HEALTHY[key]:g}", "points": round(pts), "component": comp, "action": action})
    reasons.sort(key=lambda r: -r["points"])
    level = "high" if risk >= 0.5 else "watch" if risk >= 0.25 else "low"
    top = reasons[0] if reasons else None
    return {"risk_pct": round(risk * 100), "level": level, "reasons": reasons[:3],
            "component": top["component"] if top else None,
            "action": top["action"] if top else "No action needed. Normal walkaround."}


@app.post("/predict/health")
def predict_health(day: HealthDay):
    return _health(day.model_dump())


# ---------------------------------------------------------------- fuel run-out forecast
CO2_KG_PER_L = 2.68  # diesel, standard emission factor


class FuelTask(Task):
    start: str = "09:00"
    title: str = ""


class FuelPlan(BaseModel):
    fuel_l: float = 78
    tank_l: float = 345
    now: str = "07:00"
    reserve_l: float = 15
    between_tasks_lph: float = 5.0  # mix of short moves, idle and small jobs between planned tasks
    tasks: list[FuelTask] = []


def _mins(hhmm: str) -> float:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _clock(mins: float) -> str:
    mins = int(round(mins))
    return f"{mins // 60:02d}:{mins % 60:02d}"


def _fuel(plan: dict):
    tasks = sorted(plan["tasks"], key=lambda t: _mins(t["start"]))
    if not tasks:
        return {"tasks": [], "litres_planned": 0, "co2_kg": 0, "runs_out_at": None, "refuel_before": None,
                "fuel_left_end_l": plan["fuel_l"]}
    X = pd.get_dummies(pd.DataFrame(tasks)[CAT_COLS + NUM_COLS], columns=CAT_COLS, dtype=float)
    lph = fuel_bundle["model"].predict(X.reindex(columns=fuel_bundle["columns"], fill_value=0.0))
    dur = _predict(tasks)["p50"]
    left, t, usable = plan["fuel_l"], _mins(plan["now"]), plan["fuel_l"] - plan["reserve_l"]
    used, out_at, refuel_before, rows = 0.0, None, None, []

    def burn(litres, rate_lph, start):
        nonlocal used, out_at
        if out_at is None and used + litres > usable:
            out_at = start + (usable - used) / rate_lph * 60
        used += litres

    for i, task in enumerate(tasks):
        start = max(_mins(task["start"]), t)
        gap_l = (start - t) / 60 * plan["between_tasks_lph"]
        burn(gap_l, plan["between_tasks_lph"], t)
        task_l = float(lph[i]) * float(dur[i]) / 60
        if out_at is None and refuel_before is None and used + task_l > usable:
            refuel_before = task.get("title") or task["task_type"]
        burn(task_l, float(lph[i]), start)
        t = start + float(dur[i])
        rows.append({"title": task.get("title") or task["task_type"], "start": _clock(start), "end": _clock(t),
                     "lph": round(float(lph[i]), 1), "litres": round(task_l, 1),
                     "fuel_left_l": round(plan["fuel_l"] - used, 1)})
    return {"tasks": rows, "litres_planned": round(used, 1), "co2_kg": round(used * CO2_KG_PER_L),
            "runs_out_at": _clock(out_at) if out_at is not None else None, "refuel_before": refuel_before,
            "fuel_left_end_l": round(plan["fuel_l"] - used, 1)}


@app.post("/forecast/fuel")
def forecast_fuel(plan: FuelPlan):
    return _fuel(plan.model_dump())


# ---------------------------------------------------------------- site / fleet view
JUSTIFIED_IDLE = ("waiting_for_truck", "heat_rest", "warm_up", "cool_down")
# the official telemetry sample; "Unfastened" hours carry an assumed 30 min belt-off
OFFICIAL_ROWS = [
    {"time": "2025-05-01 08:00", "fuel_l": 5.2, "load_cycles": 12, "idle_min": 30, "seatbelt": "Fastened", "alert": "No"},
    {"time": "2025-05-01 10:00", "fuel_l": 3.8, "load_cycles": 2, "idle_min": 55, "seatbelt": "Unfastened", "alert": "Yes"},
    {"time": "2025-05-01 14:00", "fuel_l": 6.1, "load_cycles": 10, "idle_min": 15, "seatbelt": "Fastened", "alert": "No"},
    {"time": "2025-05-02 09:00", "fuel_l": 2.0, "load_cycles": 1, "idle_min": 60, "seatbelt": "Unfastened", "alert": "Yes"},
]


@app.get("/fleet")
def fleet():
    machines, alerts = [], []
    for m in json.loads((DATA / "fleet.json").read_text()):
        h = _health(m["health"])
        f = _fuel({"fuel_l": m["fuel_l"], "tank_l": m["tank_l"], "now": "13:30", "reserve_l": m["tank_l"] * 0.05,
                   "between_tasks_lph": 5.0, "tasks": m["tasks"]})
        b = score_behaviour(HourStats(**m["hour_stats"]))
        idle_total = sum(m["idle_min"].values())
        waste = m["idle_min"]["waste"]
        machines.append({k: m[k] for k in ("id", "make", "model", "kind", "operator", "zone", "x", "y", "hours",
                                           "tank_l", "fuel_l", "working_h", "service_due_h", "cycles", "payload_t",
                                           "seatbelt_violations", "faults")}
                        | {"idle_min": idle_total, "idle_waste_min": waste, "idle_by_reason": m["idle_min"],
                           "fuel_pct": round(m["fuel_l"] / m["tank_l"] * 100), "health": h, "fuel_plan": f,
                           "behaviour": b})
        if h["level"] == "high":
            alerts.append({"level": "high", "machine": m["id"], "text": f"{h['risk_pct']}% failure risk in 50 h: {h['action']}"})
        elif h["level"] == "watch":
            alerts.append({"level": "medium", "machine": m["id"], "text": f"Health watch ({h['risk_pct']}%): {h['action']}"})
        if f["runs_out_at"]:
            alerts.append({"level": "high", "machine": m["id"], "text": f"Fuel runs out ~{f['runs_out_at']}. Send bowser before {f['refuel_before'] or 'next task'}"})
        if b["unusual"]:
            alerts.append({"level": "medium", "machine": m["id"], "text": "Unusual hour: " + "; ".join(b["reasons"][:2])})
        if m["service_due_h"] < 0:
            alerts.append({"level": "medium", "machine": m["id"], "text": f"Service {-m['service_due_h']} h overdue"})
        for fc in m["faults"]:
            alerts.append({"level": fc["severity"], "machine": m["id"], "text": f"{fc['code']} {fc['text']}"})

    rank = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: rank[a["level"]])
    work_h = sum(m["working_h"] for m in machines)
    idle_h = sum(m["idle_min"] for m in machines) / 60
    waste_h = sum(m["idle_waste_min"] for m in machines) / 60
    fuel_used = sum(m["working_h"] * 15 + m["idle_min"] / 60 * 3.8 for m in machines)
    official = [{**r, **score_behaviour(HourStats(fuel_l=r["fuel_l"], load_cycles=r["load_cycles"], idle_min=r["idle_min"],
                                                  seatbelt_off_min=30 if r["seatbelt"] == "Unfastened" else 0,
                                                  harsh_swings=1, raised_bucket_travel=0))}
                for r in OFFICIAL_ROWS]
    return {
        "site": "NH-48 widening, Sriperumbudur",
        "kpis": {
            "utilization_pct": round(work_h / (work_h + idle_h) * 100),
            "idle_pct": round(idle_h / (work_h + idle_h) * 100),
            "idle_justified_pct": round((idle_h - waste_h) / idle_h * 100),
            "idle_waste_h": round(waste_h, 1),
            "fuel_used_l": round(fuel_used),
            "co2_kg": round(fuel_used * CO2_KG_PER_L),
            "seatbelt_violations": sum(m["seatbelt_violations"] for m in machines),
            "cycles": sum(m["cycles"] for m in machines),
        },
        "machines": machines,
        "alerts": alerts,
        "alerts_pushed": sum(a["level"] == "high" for a in alerts),
        "official_rows": official,
    }


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
