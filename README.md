# Cat Operator Companion

A docking tablet that follows one excavator operator through his whole day.
Built for the Caterpillar hackathon problem statement "Smart Operator Assistant for CAT machinery".

- **Handheld mode**: the operator's own screen. Pre-shift briefing, today's tasks with a predicted time range, verified hours, lessons from his own shifts, skill passport.
- **Docked mode**: plug the tablet into the machine and it becomes the machine display. 3D site view, live machine data, safety interlocks, idle reasons, voice near-miss reports.

Demo scope: one operator (Ravi, OP1001) on one machine (Cat 320 excavator, EXC001), matching the sample data in the problem statement.

## What works today

| Feature | Expected outcome it covers | How |
| --- | --- | --- |
| Pre-shift briefing + task list | Daily task dashboard | React, data in `frontend/src/data/demo.ts` |
| Task time as P10 / P50 / P90 with reasons | Task time estimation | Gradient boosting, quantile loss (`ml/train.py`) |
| Dock animation: machine ID, J1939 read, profile, joystick pattern check | Operator companion | `docked/DockTransition.tsx` |
| 3D site: excavator dig/swing/dump cycle, dumpers arriving, workers, fibre line, 11 kV line | Proximity hazards, working conditions | react-three-fiber (`docked/SiteScene.jsx`) |
| Swing radius watch: green, amber, red. Swing held when a person is inside. | Proximity hazards | distance check every frame |
| Restart guard: work cannot restart after idle while the seatbelt is off | Seatbelt compliance | interlock in the sim |
| Idle counter in minutes, litres and rupees, with the reason | Unusual behaviour (idling) | Random forest (`/classify/idle`) |
| "Next truck in 6 min, switch off" nudge | Unusual behaviour (idling) | truck ETA from the site |
| Voice near-miss report + 60 s black box | Incident logging | Web Speech API (hi-IN), structured report |
| Unusual hour detection | Unusual behaviour | Isolation forest + readable rules (`/score/behaviour`) |
| Lessons from yesterday's events | Operator training hub | handheld screen |
| Safe / Caution / Critical lamp on the machine display: one state fused from seatbelt, swing-radius distance, today's history and the operator's twin, always with a one-line reason; debounced so it can't flicker. Critical entries are logged; the supervisor sees each machine's state | Safety features | Rules (`frontend/src/lib/risk.ts`, `fuse_risk` in `api.py`) |
| Digital twin: every hour is compared with the operator's *own* usual in the same conditions (task × weather × machine), not a site-wide rule. Learns from each shift at undock. "My twin" page shows how he works vs the site and what the twin found in his data | Unusual behaviour | Per-operator running statistics (`ml/twin.py`, `/twin/*`) |
| Machine health before you start: failure risk in the next 50 h, top reason, walkaround item | Safety features, operator companion | Gradient boosting classifier (`/predict/health`) |
| Fuel plan: when the tank hits reserve today and which task to refuel before | Daily task dashboard | Fuel-rate model × task-time model (`/forecast/fuel`) |
| What-if on a task (change weather, skill, soil, re-predict) | Task time estimation | `/predict/task` |
| Unusual behaviour card while docked, per-hour rates from the sim | Unusual behaviour | Isolation forest + rules (`/score/behaviour`) |
| End-of-shift summary: verified hours, idle split justified vs avoidable, events, new lessons | Operator training hub, unusual behaviour | handheld screen, from the sim |
| Supervisor view: site KPIs, machine table, health and fuel predictions, site map, alert budget, official telemetry rows scored | All five | `fleet/FleetPages.tsx`, `GET /fleet` |
| Shift Copilot: at most 5 ranked actions for the operator's day, each joining 2+ sources (plan, forecast, site hazards, health and fuel models, his twin, yesterday's events) | Daily task dashboard, safety features | `ml/insights.py`, `POST /insights`, `operator/ShiftCopilot.tsx` |
| Site Copilot: at most 5 decisions for the supervisor, each with an owner and "if nobody acts", plus a one-line site status | All five | `ml/insights.py`, `GET /insights/site`, `fleet/SiteCopilot.tsx` |
| Operator ↔ supervisor messages ("Tell supervisor", "Send to operator") and an in-cab "next best action" | Safety features, incident logging | `/inbox`, `lib/liveInsights.ts` |

## Run it

Two terminals.

**1. ML API** (Python 3.10+)
```bash
cd ml
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python generate_data.py     # synthetic history (data/*.csv)
python train.py             # trains 5 models, prints metrics
uvicorn api:app --reload --port 8000    # docs at http://localhost:8000/docs
```

**2. Frontend**
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
npm run check               # TypeScript + lint
```
If the API is not running, the app still works and falls back to cached predictions.

## Shift Copilot and Site Copilot, in plain words

The dashboards show a lot of correct numbers; the Copilots turn them into a few actions. Each rule in `ml/insights.py` joins two or more sources and fires only when the combination says something no single card says, for example: tank hits reserve ~14:43 (fuel model) + T103 starts 14:30 (plan) + parked 13:00–13:40 anyway (heat rest) → "Refuel during the heat rest". Items are scored by how serious, how soon and how sure, capped at 5, and every item shows its sources and evidence ("Why this?"). The rules and models decide; no text is generated.

- **Operator (12 rules):** walkaround item from machine health × today's dusty work, refuel slot, rain on a task, hazards in a task's zone, yesterday's near-miss where he works today, habits from his twin (belt and idle in rain, belt off after long idles, late-shift slump), joystick pattern, switch-off habit, service window, a "well done".
- **Supervisor (13 rules):** critical belt risk now, pull a failing machine (and the knock-on truck gap), bowser run in one trip, rental call, operating style wearing a part, dumper rebalance, afternoon schedule slip, zone spotter, targeted belt talk, mentor pairing, tonight's workshop list, operators' messages, a "well done".
- **Site facts** (forecast, breaks, hazards, yesterday's events) live in one file, `ml/data/site_day.json`, so the two screens never disagree. Demo clocks on both cards re-rank the lists (07:00 / 09:00 / 12:30 / 15:30 and 13:30 / 15:30).
- **Self-check:** `cd ml && python insights.py` asserts the expected items at each demo time, the 5-item cap, the 2-source rule and a message each way.

## ML, in plain words

| Model | Question it answers | Algorithm | Current result |
| --- | --- | --- | --- |
| Task time | How long will this job take, and how sure are we? | Gradient boosting with quantile loss, 3 models (P10, P50, P90) | Error 7.1 min against the planner's 19.8 min |
| Idle reason | Why is the engine on with no work? | Random forest on 9 window features | 98.3% accuracy on synthetic data |
| Unusual behaviour | Was this hour unusual for this operator? | Isolation forest + rules that give a plain reason | 100% precision, 89% recall on planted anomalies. Flags exactly the 10:00 and next-day 09:00 rows of the official sample |
| Machine health | Will this machine have a failure in the next 50 engine hours, and why? | Gradient boosting classifier on sensors + S·O·S oil sample | ROC AUC 0.83. Top 10% riskiest: 75% really fail, against a 16.5% base rate |
| Fuel burn rate | How many litres per hour will this task burn? | Gradient boosting regressor, same features as task time | Error 0.87 L/h against 2.81 L/h for one flat rate |
| Operator digital twin | Is this hour unusual *for this person, in these conditions*? | Running mean/spread per operator × condition (Welford, updated incrementally), z-score with plain reasons | On 900 held-out hours: catches 95% of planted anomalies with 67% of flags real, against 81% / 40% for one site-wide threshold. Agrees with the brief's alert column on all 4 official rows |

Explanations: for each task, we re-predict with one factor set to an "easy day" value (sunny, expert, loam, new machine) and report the difference in minutes. That is the "+7 min: soil clay" chip. The health model uses the same trick: put one reading back to its healthy value, and the drop in risk is that reading's share ("Silicon 24 ppm, usual 8: +41 pts, check the air filter").

Fuel run-out: litres per task = fuel-rate model × P50 minutes from the task-time model, plus 5 L/h between tasks. The time the tank hits reserve is the first point on that timeline where the reserve is crossed.

## Compared with Cat VisionLink

VisionLink (Cat's fleet telematics app) already gives owners hours, location, utilization, idle time with an excessive-idle threshold, fuel and DEF levels, CO2 from fuel burned, fault codes, service and inspection due dates, S·O·S fluid analysis, productivity KPIs (cycles, payload, seat belt violations), geofences, alerts and reports, for mixed fleets. We don't claim any of that as new. The supervisor view shows the same kind of numbers and adds three things:

1. **Prediction, not only history.** Failure risk in the next 50 h per machine, and the time the tank hits reserve against today's plan.
2. **A reason next to every number.** Idle is split by reason (waiting for truck, heat rest, warm-up, cool-down, waste), so only waste counts against anyone. Each health risk names the reading behind it and what to check.
3. **The operator sees it too.** The same health result turns into the first walkaround item on the operator's tablet, and the fuel forecast into "refuel before T103". Coaching, not surveillance. An alert budget pushes only high-severity items to phones.

The fleet data (6 machines, including a non-Cat backhoe to show mixed fleet) is synthetic, in `ml/data/fleet.json`. The API scores it with the real models on every request. The frontend keeps a saved copy of one real API response (`frontend/src/data/fleet_fallback.json`) for when the API is down.

Synthetic data: `generate_data.py` extends the two tables from the problem statement and plants known patterns (skill, weather, soil, machine age multipliers; the planner ignoring skill; unbuckling during long idles). The 5 official task rows are kept as the first rows.

## Structure
```
frontend/   React 19 + TypeScript + Vite + Tailwind v4 + react-three-fiber
  DESIGN.md                        design system: tokens, type, components, motion, accessibility
  src/styles/globals.css           design tokens (light handheld, dark cab display)
  src/components/ui/               primitives: Button, Card, StatusBadge, Kpi, Dialog, Segmented…
  src/components/shared/           app shell: sidebar, top bar, ⌘K command palette, telemetry table
  src/components/operator/         Today, Site & safety, Training hub, Hours & activity, voice briefing
  src/components/docked/           docking sequence, in-cab machine display, 3D site scene
  src/components/fleet/            supervisor: Site overview, Telemetry audit
  src/hooks/queries.ts             ML API calls (React Query) with cached fallbacks
  src/store/app.ts                 app state (Zustand), URL-synced pages
  src/lib/sim.ts                   shared simulation state
ml/         data generator, training (5 models), FastAPI server
```

Shortcuts: `⌘K` / `Ctrl K` search and jump anywhere. On the docked display: `W` worker walks in, `B` unbuckle during idle, `V` voice near-miss, `H` hide the demo buttons.

## Roadmap (pitch only, not built)
Site mesh between tablets, auto E-fence from Call Before u Dig data, shift handover cards, mentor mode, weekly fatigue and vibration dose, skill passport QR.
