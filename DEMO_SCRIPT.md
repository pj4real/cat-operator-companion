# Demo script: one day as Ravi

About 6–7 minutes. You narrate as Ravi (first person) with a few lines as yourself at the start and end.

## Before you start

1. Start the ML API (`uvicorn api:app --port 8000` in `ml/`) and the frontend (`npm run dev` in `frontend/`).
2. Open `http://localhost:5173/?story` in Chrome, full screen (⌘⇧F / F11). `?story` opens Story mode on chapter 1.
3. Check the top bar says **Models live**. If it says *Offline · cached*, everything still works with cached predictions; say so if asked.
4. Allow the microphone once if Chrome asks (chapter 8). If you don't, a sample Hindi transcript is used and the report says so.
5. Optional: on the `tablet-frame` branch the whole app runs inside a rugged tablet. `F` toggles it.

**Keys:** `→` / `←` next and previous chapter · `C` subtitles on/off · `S` hide/show the chapter bar · `?` help drawer (in the cab) · `H`, `W`, `B`, `V` demo buttons in the cab when Story mode is off.

Each chapter sets the app up for you (it moves site time, walks the worker in, unbuckles the belt), so you never wait for the simulation. Talk, then press `→`.

## Chapters

| # | Chapter | What they see | What you say (as Ravi unless marked) |
|---|---|---|---|
| 1 | The problem | Title card, three facts | *(as yourself)* "The machine knows everything about itself. Nothing on site knows the person driving it. Excavators idle about 30% of their hours, the telematics can't say why. And in the brief's own data, the belt came off only in long idles." |
| 2 | Morning briefing | Dark screen, white orb, "Good morning, Ravi". Tap **Start briefing** | "It's 6:40. I pick up my tablet at home." Let the voice play; the room brightens with each point. |
| 3 | Today's plan | Dashboard, three tasks | "Three jobs today. The trenching will take about an hour, not the 50 minutes on the plan, because of the clay. And I need to refuel before the grading." Tap a task to show the reasons and the what-if. |
| 4 | Walkaround | Photo with numbered checks, air filter first | "My walkaround starts with the air filter, because the health model saw dust in last night's oil sample. That's the one thing I'd have skipped." Tap **OK** or **Report issue**. |
| 5 | Dock to the machine | Dock animation, joystick warning | "I dock into today's machine, a rental. It's set to SAE, I run ISO. It tells me before I make a wrong move." Tap **Switch to ISO**. |
| 6 | Idle, with a reason | Idle panel, reason, switch-off button, spoken nudge | "The truck just left. The model knows why I'm idle, waiting for a truck, and that the next one is 6 minutes out. So: switch off." Tap the yellow button. |
| 7 | Someone walks in | Lamp turns **Critical**, swing held, voice alert, supervisor's phone card | "A new worker, his third day, walks into my swing. It stops the swing and tells me why. My supervisor gets this one. Only the serious ones go to his phone." |
| 8 | Restart guard | Belt off; when the truck returns, the guard blocks the restart | "I took my belt off during the long wait. Everyone does. The truck's back, and it won't let me start until I buckle up. That came straight from your sample data." Tap **Seatbelt fastened**. |
| 9 | Near-miss, by voice | Listening, then a report with the black box | Say something in Hindi, e.g. *"Dumper peeche se aaya, bahut paas tha."* "I report it in my language. The severity comes from the black box, not from what I said. The black box is my witness." Tap **Send to safety officer**. |
| 10 | Help on the machine | Video plays, camera flies into the cab, start button glows | "New machine, new buttons. I ask how to start it without a key. The video plays, and my own cab shows me the button." |
| 11 | End of shift | Evening greeting, day timeline, lessons | "End of the day. My hours are verified, idle is split into what was justified and what I could have avoided, and I get two short lessons from my own day." |
| 12 | His twin learned | "Your working pattern" page, toast "600 → 601 hours" | "Every alert compared me with myself, in the same conditions. Tonight my twin learned from today. It knows my idle goes up in the rain and after hour seven." |
| 13 | The supervisor's view | Fleet table, risk now, alerts | *(as the supervisor, or yourself)* "The same predictions for the whole site, with the reason behind every number." |
| 14 | Impact | Title card | *(as yourself)* "About 34 thousand rupees of fuel a year per excavator from idle alone, three interlocks from context, and a twin that catches 95% of unusual hours against 81% for one rule. Next: a mesh between tablets and auto E-fence from Call Before u Dig." |

## Questions reviewers are likely to ask

- **Is the data real?** No. It's synthetic, with patterns planted on purpose, and the README says which. The four official telemetry rows from the brief are scored by the same models, and the twin agrees with the brief's alert column on all four.
- **Where is the AI?** Five scikit-learn models plus the operator twin: task time (P10/P50/P90, calibrated to 82% coverage), idle reason, unusual behaviour, machine health, fuel rate. The LLM only words the near-miss report. Severity comes from the black box by rule.
- **Why not a chatbot?** Cat already has an in-cab voice assistant. We used AI where a decision is made (when to switch off, what to check first, whether an hour is unusual for this person) and kept every decision explainable.
- **How is this different from VisionLink?** VisionLink shows the machine's history. This predicts (failure risk, fuel reserve time), gives a reason for every number, and gives the same result to the operator as coaching, not surveillance.

## If something goes wrong

- **3D view frozen:** press `←` then `→` to re-enter the chapter. If still frozen, reload; `?story` brings you back to chapter 1, and you can click any chapter number on the bar.
- **No sound in the briefing:** it falls back to the browser voice; if that is silent too, the captions still advance.
- **No internet:** the help videos need YouTube; everything else runs locally.
- **API down:** predictions show *Cached*; say "this is the offline fallback the tablet uses on site".
