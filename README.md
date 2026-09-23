# Cat Operator Companion

A docking tablet that follows one excavator operator through his whole day.
Built for the Caterpillar hackathon problem statement "Smart Operator Assistant for CAT machinery".

- **Handheld mode**: the operator's own screen. Pre-shift briefing, today's tasks with a predicted time range, verified hours, lessons from his own shifts, skill passport.
- **Docked mode**: plug the tablet into the machine and it becomes the machine display. 3D site view, live machine data, safety interlocks, idle reasons, voice near-miss reports.

Demo scope: one operator (Ravi, OP1001) on one machine (Cat 320 excavator, EXC001), matching the sample data in the problem statement.

## What works today

| Feature | Expected outcome it covers | How |
| --- | --- | --- |
| Pre-shift briefing + task list | Daily task dashboard | React, data in `frontend/src/data/demo.js` |
| Task time as P10 / P50 / P90 with reasons | Task time estimation | Gradient boosting, quantile loss (`ml/train.py`) |
| Dock animation: machine ID, J1939 read, profile, joystick pattern check | Operator companion | `DockTransition.jsx` |
| 3D site: excavator dig/swing/dump cycle, dumpers arriving, workers, fibre line, 11 kV line | Proximity hazards, working conditions | react-three-fiber (`SiteScene.jsx`) |
| Swing radius watch: green, amber, red. Swing held when a person is inside. | Proximity hazards | distance check every frame |
| Restart guard: work cannot restart after idle while the seatbelt is off | Seatbelt compliance | interlock in the sim |
| Idle counter in minutes, litres and rupees, with the reason | Unusual behaviour (idling) | Random forest (`/classify/idle`) |
| "Next truck in 6 min, switch off" nudge | Unusual behaviour (idling) | truck ETA from the site |
| Voice near-miss report + 60 s black box | Incident logging | Web Speech API (hi-IN), structured report |
| Unusual hour detection | Unusual behaviour | Isolation forest + readable rules (`/score/behaviour`) |
| Lessons from yesterday's events | Operator training hub | handheld screen |

## Run it

Two terminals.

**1. ML API** (Python 3.10+)
```bash
cd ml
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python generate_data.py     # synthetic history (data/*.csv)
python train.py             # trains 3 models, prints metrics
uvicorn api:app --reload --port 8000    # docs at http://localhost:8000/docs
```

**2. Frontend**
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```
If the API is not running, the app still works and falls back to cached predictions.

## ML, in plain words

| Model | Question it answers | Algorithm | Current result |
| --- | --- | --- | --- |
| Task time | How long will this job take, and how sure are we? | Gradient boosting with quantile loss, 3 models (P10, P50, P90) | Error 7.1 min against the planner's 19.8 min |
| Idle reason | Why is the engine on with no work? | Random forest on 9 window features | 98.6% accuracy on synthetic data |
| Unusual behaviour | Was this hour unusual for this operator? | Isolation forest + rules that give a plain reason | 96% precision, 83% recall on planted anomalies |

Explanations: for each task, we re-predict with one factor set to an "easy day" value (sunny, expert, loam, new machine) and report the difference in minutes. That is the "+7 min: soil clay" chip.

Synthetic data: `generate_data.py` extends the two tables from the problem statement and plants known patterns (skill, weather, soil, machine age multipliers; the planner ignoring skill; unbuckling during long idles). The 5 official task rows are kept as the first rows.

## Structure
```
frontend/   React + Vite + Tailwind + react-three-fiber
  src/components/NormalMode.jsx     handheld screen
  src/components/DockTransition.jsx docking sequence
  src/components/DockedMode.jsx     machine display + safety logic
  src/components/SiteScene.jsx      3D site and excavator
  src/lib/sim.js                    shared simulation state
ml/         data generator, training, FastAPI server
```

## Roadmap (pitch only, not built)
Site mesh between tablets, auto E-fence from Call Before u Dig data, shift handover cards, mentor mode, weekly fatigue and vibration dose, skill passport QR.
