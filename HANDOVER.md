# HANDOVER: Cat Operator Companion (hackathon)

Read this first in Claude Code. It has everything from the planning session: context, decisions, current code state, how to run it, what's next, and the facts for the pitch.

---

## 1. Context

- **Event:** one-day Caterpillar hackathon, part of placement. Stage 1 = ideation + prototype review at **16:30 IST on 23 Sep 2026**. Shortlisting is partly done by an AI, and the reviewers are from industry.
- **Team:** Prakhar (ML, backend, networking and security interest) + one partner. Both fine with React. Using AI to build is allowed.
- **Judging:** tech stack, uniqueness, and other unstated metrics. Every team got the same problem statement, so novelty matters most.
- **Repo:** `~/projects/cat-operator-companion` (private GitHub repo `pj4real/cat-operator-companion`, if the push command was run).
- **Planning doc (research, ideas, operator-day simulation):** https://claude.ai/code/artifact/fdb66ec9-6015-4910-85ce-99a040428d08 (3 tabs: main plan, Operator day and week, Big idea and Ravi's day).

### Problem statement (verbatim summary)
"Smart Operator Assistant for CAT machinery". An end-to-end, multi-functional operator interface, "an intelligent companion" that supports machine operators through the workday: efficiency, safety, training.

Expected outcomes (cover all five, **using these exact words** in the UI and the pitch, so the AI screener can tick them off):
1. **Daily task dashboard**: view scheduled tasks for the day
2. **Safety features**: seatbelt compliance, proximity hazards, incident logging (working conditions to be considered)
3. **Operator training hub**: any format, e.g. e-learning videos, instructor booking, simulation module
4. **Identify unusual behaviour in machine usage**, e.g. excessive idling, unsafe operation patterns
5. **Task time estimation**: predict task time from past data and environmental conditions

Sample data they gave:

| Timestamp | Machine | Operator | Engine Hrs | Fuel (L) | Load Cycles | Idle (min) | Seatbelt | Alert |
|---|---|---|---|---|---|---|---|---|
| 2025-05-01 08:00 | EXC001 | OP1001 | 1523.5 | 5.2 | 12 | 30 | Fastened | No |
| 2025-05-01 10:00 | EXC001 | OP1001 | 1524.8 | 3.8 | 2 | 55 | Unfastened | Yes |
| 2025-05-01 14:00 | EXC001 | OP1001 | 1526.5 | 6.1 | 10 | 15 | Fastened | No |
| 2025-05-02 09:00 | EXC001 | OP1001 | 1530.2 | 2.0 | 1 | 60 | Unfastened | Yes |

| Task | Type | Weather | Skill | Machine age | Est. (min) | Actual (min) |
|---|---|---|---|---|---|---|
| T001 | Earth Excavation | Sunny | Expert | 2 | 60 | 58 |
| T002 | Trenching | Rainy | Intermediate | 4 | 45 | 52 |
| T003 | Material Loading | Cloudy | Beginner | 3 | 30 | 42 |
| T004 | Grading | Sunny | Expert | 5 | 35 | 33 |
| T005 | Demolition | Windy | Intermediate | 6 | 90 | 105 |

They said we may assume any data can be gathered and may generate synthetic data. It should not be limited to an IoT project. An AI component is expected, but **not a cliché chatbot**.

### Three findings from their own data (use in the pitch)
- Seatbelt is unfastened **only in the high-idle, low-work rows** (55 and 60 min idle, 1 to 2 cycles). Unbuckling happens during idle and carries into the restart. This is the basis for the **restart guard**.
- Fuel per load cycle: 0.43 and 0.61 L in productive hours against 1.9 and 2.0 L in idle hours.
- Planner estimates are biased by skill and weather: the beginner ran 40% over, rain +16%, wind +17%, while experts finished 3 to 6% early.

---

## 2. The concept (decided)

**Thesis:** every operator carries one tablet all day. **Handheld**, it's his own companion: briefing, tasks, hours, training, career. **Docked** into the machine (reading the ECU over CAN/J1939), it becomes the machine display. All tablets on a site together form a live 3D model of the site: *the crew is the sensor network*.

Three layers: **Me** (person), **My machine** (docked), **My site** (mesh of tablets).

**Scope for the demo:** ONE operator (Ravi, OP1001) on ONE machine (**Cat 320 excavator, EXC001**). The excavator was chosen over a dump truck because their data is EXC001, all 5 task types are excavator jobs, and it shows the most features (swing radius, E-fence, joystick pattern, truck waiting). Dump trucks appear as supporting vehicles in the scene.

**Positioning against what Cat already sells (don't claim these as new):**
- **Cat AI Assistant** (CES, Jan 2026): voice assistant, manuals, coaching, runs in-cab on NVIDIA Jetson Thor. So **no chatbot**.
- **Cat Detect**: camera people detection, 3 zones, up to 9 m and 270° on excavators.
- **Operator Coaching**: in-cab tips and an efficiency score.
- **Operator profile**: pattern, spool response and HVAC per operator, unlocked by passcode or Bluetooth key. It lives in the machine, not with the person.
- **2D E-fence**: ceiling, floor, swing and wall limits, **set manually by the operator**.
- **Cat Inspect**: digital inspection checklists.
- **MineStar Detect**: peer-to-peer proximity awareness between machines, mining only, since 2016.

**Our novelty lines:**
- The operator-owned docking device: identity, profile and history travel to any machine, including rentals and other brands.
- **Auto E-fence from site data** (Call Before u Dig fibre routes, power lines). This is the lead insight.
- **Conflicts predicted from the day's plan**, not only from proximity sensors.
- **Idle with a reason** (waiting for a truck, heat rest, warm-up, cool-down, waste), plus a truck-ETA engine-off nudge.
- **Restart guard**, which comes straight from their data.
- **Lessons from my own shift**, the skill passport, verified hours.
- Design principles: the models decide and the LLM only explains; coaching, not surveillance; an alert budget; the black box is framed as the operator's witness.

**Honesty rules for the pitch:** the data is synthetic (say so). Mesh, mentor mode, passport QR and weekly fatigue are roadmap items. Don't claim Cat-internal facts that aren't sourced.

---

## 3. Current code state (working, tested in headless Chromium)

```
cat-operator-companion/
  README.md, HANDOVER.md, .gitignore   (ml/models/*.joblib is gitignored: retrain locally)
  frontend/   React 19 + Vite 8 + Tailwind v4 (@tailwindcss/vite) + three + @react-three/fiber 9 + drei 10 + lucide-react
    src/App.jsx                      mode state: normal | docking | docked; device status bar; "Today so far" on undock
    src/components/NormalMode.jsx    handheld screen: greeting, clock-in, briefing (4 items + comprehension sign-off),
                                     3 tasks with live ML P10/P50/P90 + reason chips + range bar vs planner,
                                     DOCK button, verified hours chart, lessons, skill passport
    src/components/DockTransition.jsx 6-step docking sequence (~3 s)
    src/components/DockedMode.jsx    machine display: top strip (truck ETA, seatbelt, undock), 3D scene,
                                     right panel (fuel, rpm, hyd temp, cycles; idle card with ML reason + switch-off nudge;
                                     limits from site data; event log), demo buttons, modals:
                                     joystick pattern mismatch (SAE vs ISO), restart guard, voice near-miss report + black box
    src/components/SiteScene.jsx     3D: procedural articulated excavator (house/boom/stick/bucket, keyframed dig-swing-dump),
                                     dumper on a 60 s loop, 2 workers (one "Day 3" NEW with pulsing ring), swing ring coloured by zone,
                                     trench, spoil, dashed fibre line + label, 11 kV poles/wires at z=-22 + E-ceiling plane,
                                     Controller (useFrame) runs the sim and interlocks
    src/lib/sim.js                   shared mutable sim state; SIM_SPEED=15 (1 real s = 15 site s); truckPhase(); logEvent()
    src/lib/api.js                   POST to VITE_API_URL (default http://localhost:8000), 2.5 s timeout; callers fall back
    src/data/demo.js                 operator, machine, tasks (+ fallback predictions), briefing, lessons, hourly
  ml/
    generate_data.py  -> data/tasks.csv (3,005 rows, 5 official rows first), idle_windows.csv (4,000), shift_hours.csv (900)
    train.py          -> models/task_time.joblib, idle_reason.joblib, behaviour.joblib, metrics.json
    api.py            FastAPI: POST /predict/task, /classify/idle, /score/behaviour; GET /health; CORS open
    requirements.txt
```

### Simulation logic (SiteScene Controller + sim.js)
- Truck loop (60 s real): drives in 0–6 s, loads 6–32 s, leaves 32–38 s, absent 38–60 s. The ETA shown is scaled by SIM_SPEED (about 6 site minutes of gap).
- `working = truckPresent && engineOn && !halted`. The excavator animates and counts cycles only while working.
- Idle accumulates when the engine is on and not working: fuel at 3.8 L/h, diesel at ₹90/L.
- Zones by worker distance from the excavator: under 7 m is danger (swing held), under 11 m is caution, otherwise clear.
- Restart guard: halted if `beltScenario && !seatbelt && truckPresent && engineOn`.
- Demo buttons: "New worker walks in" / "Worker leaves", "Unbuckle during idle", "Report near-miss (voice)" (Web Speech hi-IN, with a fallback Hindi transcript; the structuring is currently rule-based in the frontend).
- The black box is a ring buffer of snapshots every 250 ms (240 entries). The report shows 6 samples from the last 60 s.

### ML (keep it explainable)
| Model | Algorithm | Metric (synthetic) |
|---|---|---|
| Task time P10/P50/P90 | GradientBoostingRegressor, loss=quantile, 3 models, 300 trees, depth 3 | MAE **7.09 min against the planner's 19.84**, P10–P90 coverage 73% |
| Idle reason (5 classes) | RandomForestClassifier, 200 trees, depth 10, 9 features | accuracy 98.6% (top feature: next_truck_eta_min) |
| Unusual behaviour | IsolationForest (contamination 0.06) + readable rules | precision 96%, recall 83% on planted anomalies |

Explanation method: re-predict P50 with one factor set to an "easy day" value (Sunny, Expert, Loam, age 1, 30 °C) and show the delta in minutes. No SHAP needed.

Planted patterns: skill ×1.35/1.10/0.95; rain ×1.16 on trenching, grading and excavation; wind ×1.17 on demolition; soil ×0.95–1.28; +2% per machine year; heat above 38 °C ×1.08; lognormal noise 8%. The planner ignores skill and weather.

Known caveats: 98.6% idle accuracy is high because the data is synthetic (say so). P10–P90 coverage is 73%, not 80%. You could widen it with alpha 0.05/0.95.

---

## 4. Run

```bash
# ML API
cd ~/projects/cat-operator-companion/ml
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python generate_data.py && python train.py
uvicorn api:app --reload --port 8000        # http://localhost:8000/docs

# Frontend
cd ~/projects/cat-operator-companion/frontend
npm install && npm run dev                  # http://localhost:5173
```
Task cards show "● ML model live" when the API is reachable, otherwise "○ cached estimate".

If the repo wasn't pushed yet:
```bash
cd ~/projects/cat-operator-companion && git init -b main && git add -A && git commit -m "Starter" && gh repo create cat-operator-companion --private --source=. --push
```

---

## 5. Next tasks (priority order, time-boxed for the 16:30 review)

**P0: demo polish (must)**
1. **End-of-shift summary screen** (on Undock or an "End shift" button): verified hours incl. overtime, load cycles, idle minutes/L/₹ with the share that was justified vs waste, events, "my contribution" (e.g. "38 m trench, section B 70%"), 1–2 lessons generated from today's events, and passport progress.
2. **Unusual behaviour card**: call `/score/behaviour` with the current hour's stats from the sim (idle min, cycles, seatbelt-off minutes, harsh swings) and show the flag + plain reasons. Also render the official 4-row telemetry table in "Today" with the model's flag per row (the 10:00 and next-day 09:00 rows should flag).
3. **Name "expected outcomes" explicitly** in the UI, e.g. small labels "Daily task dashboard", "Seatbelt compliance", "Proximity hazards", "Incident logging", "Training hub", "Unusual behaviour", "Task time estimation".
4. **What-if on a task** (swap weather/skill/soil in a dropdown, re-call `/predict/task`), which shows the model is real.
5. **Near-miss structuring via an LLM (optional)**: add `POST /structure/incident` in `api.py` using the Anthropic API with a JSON schema. Keep the rule-based fallback. The LLM only formats; it never decides.

**P1: 3D polish (nice)**
- Better excavator pose so the bucket visibly dumps into the truck bed. Tune `KEYS` in SiteScene.jsx.
- A "cab view" camera toggle; the E-floor shown as a translucent plane under the trench when the bucket goes deep.
- A second machine plus a "planned conflict in Zone B at 11:00" overlay (plan-based conflict forecast).
- Hide the demo buttons behind a keyboard shortcut for a cleaner demo.

**P2: training hub**
- A handheld "Training" tab: lessons from own events, 2D/3D replay of the near-miss as a scenario quiz, instructor booking slot picker (this covers the "instructor booking" example in the problem statement).

**Roadmap only (slides):** site mesh (Wi-Fi Direct/BLE), auto E-fence from Call Before u Dig, shift handover cards, mentor mode, weekly fatigue + whole-body vibration dose (A(8) against 0.5/1.15 m/s²), skill passport QR, verified hours for pay, "new here" site onboarding.

---

## 6. Demo script (5 min, "one day in Ravi's shift")
1. Hook: "Cat machines know everything about themselves. Nothing on site knows anything about the person driving them."
2. Handheld: briefing (fibre route, 11 kV line, 2 new workers, heat rest), tasks with P50 and range vs planner and reasons.
3. Dock: sequence, joystick pattern mismatch (rental is SAE, Ravi runs ISO), switch.
4. 3D: excavator loading the dumper. The truck leaves, idle starts, the reason is "waiting for truck", the counter shows L and ₹, "next truck in 6 min, switch off".
5. "Unbuckle during idle", the truck returns, the **restart guard** blocks work. "Your sample data showed exactly this pattern."
6. "New worker walks in": caution, then danger, swing held, event logged.
7. Voice near-miss in Hindi, then the structured report + black box: "the black box is the operator's witness."
8. Undock, end-of-shift summary, lessons, passport. Close: impact + roadmap.

Impact line (label as an estimate): idle 40% to 25% on a 1,000 h excavator is about 150 h and about 570 L diesel a year, about ₹51,000 per machine at ₹90/L. Across 100 machines that's about ₹51 lakh a year.

---

## 7. Facts for the pitch (sourced)
- Cat AI Assistant, CES Jan 2026, in-cab on Jetson Thor: caterpillar.com/en/news/corporate-press-releases/h/cat-ai-assistant.html
- Cat: digital and tech investment 2.5x through 2030; $25M over 5 years for workforce skills: caterpillar.com/en/news/corporate-press-releases/h/ai-powered-future.html
- Cat 2D E-fence is operator-set: cat.com/en_US/articles/for-owners/e-fence-enhances-jobsite-safety.html
- Excavators idle about 40% of hours; fleets 28–30%; target about 20%; about 1 gal/h at idle: constructionequipment.com (how-to-manage-engine-idling-for-efficiency)
- Struck-by: 804 US construction deaths 2011–2015, up 34% from 2010 to 2015: equipmentworld.com (CPWR data)
- US utility strikes: 668,999 in 2025, $83.2B, about $16 of knock-on cost per $1 of repair (CGA, Aug 2026): heavyequipmentguide.ca
- India: about 10 lakh fibre cuts a year, about ₹3,000 crore; DoT "Call Before u Dig" app: dtnext.in (Dec 2022)
- India CE market: 135,650 units FY24 (+26%), expected 2nd largest by 2030: india-briefing.com
- Indian operator pay ₹12–18k (fresher) to ₹28–45k (5+ yrs); overtime adds 20–40%; "skill matters more than a formal licence": desimachines.com
- Truck drivers: 45% worry about unclear data use; 30% want proof tech protects them; coaching rated effective 74% (well onboarded) vs 19%: ccjdigital.com
- Operator forum stories (heavyequipmentforums.com): telematics data "belongs to the manufacturers"; a labourer on his 3rd day nearly backed over; an oiler crushed between track and house.
- Construction suicide rate 65.6 per 100k men vs 32.0 for all working men (CDC 2021). Mention lightly, if at all.

---

## 8. Working preferences (Prakhar)
- Plain, direct language. No over-engineering. The ML has to be explainable in one breath.
- Writing should read human: no em dashes, no decorative italics, no formulaic AI phrasing.
- He reviews closely and will flag gaps between what was promised and what was delivered, so be precise about what works and what is mocked.
- Hands-on: he'll direct specific changes. Keep diffs focused.
