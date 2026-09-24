# Demo script: final review

About 10–12 minutes. Slides are full screen and light; the live app runs inside the rugged tablet. Everything is in one flow: `→` goes to the next chapter, whether it's a slide or the app.

## Before you start

1. Start the ML API (`uvicorn api:app --port 8000` in `ml/`) and the frontend (`npm run dev` in `frontend/`).
2. Open `http://localhost:5173/?story` in Chrome, full screen (⌘⇧F / F11). You land on slide 1.
3. Check the tablet's top bar says **Models live**. If it says *Offline · cached*, everything still works; say so if asked.
4. Allow the microphone once if Chrome asks (chapter 13). Without it, a sample Hindi transcript is used and the report says so.

**Keys:** `→` / `←` next / previous · `C` hides the question card · `S` hides the chapter bar · `F` tablet frame on/off · `?` help in the cab.

Each app chapter shows a **question card** under the tablet: the question someone on site has, how the feature answers it, and the data it joins. Read the question out loud, then show the answer on the tablet.

## Flow

| # | Type | Chapter | What you say |
|---|---|---|---|
| 1 | Slide | Operator Companion | "One tablet per operator. In hand it's his companion, docked it's the machine display, and together the tablets see the site. We'll follow one operator, Ravi, through one day." |
| 2 | Slide | The problem | "The machine knows everything about itself. Nothing on site knows the person driving it. 30% idle with no reason, utility strikes, and in the brief's own data, the belt came off only in long idles." |
| 3 | Slide | What exists | "Cat already ships a lot: AI Assistant, Detect, Coaching, E-fence, VisionLink. We don't rebuild any of it. The gap: none of it follows the operator, predicts, or explains why." |
| 4 | Slide | Our idea | "Three layers: me, my machine, my site. All five outcomes from the brief are covered, and you'll see each one labelled in the app." |
| 5 | App | Morning briefing | "6:40, at home." Tap **Start briefing**, let it play or **Skip**. The story moves on by itself when it ends. |
| 6 | App | Today's plan | "How long will today's jobs take? A range, not a number: trenching is about an hour, not 50 minutes, because of the clay. The Shift Copilot ranks what matters." Tap a task for **What if**. |
| 7 | App | Walkaround | "The health model read last night's oil sample. The air filter goes first." |
| 8 | Slide | How we use data | "No screen shows one source. Machine, plan, conditions and history go through five models, the twin and the Copilot, out to three screens. Three examples at the bottom." |
| 9 | App | Dock to the machine | "Rental, set to SAE. I run ISO. It tells me before the first wrong move." Tap **Switch to ISO**. |
| 10 | App | Idle, with a reason | "Why is the engine running? Waiting for a truck, and the next is 6 minutes out, so switch off." |
| 11 | App | Someone walks in | "A day-3 worker walks into the swing. Caution, then Critical: swing held. Only this one reaches the supervisor's phone." |
| 12 | App | Restart guard | "I unbuckled in the long wait. Truck's back, and it won't restart until I buckle up. That came from your sample data." Tap **Seatbelt fastened**. |
| 13 | App | Near-miss, by voice | Say in Hindi *"Dumper peeche se aaya, bahut paas tha."* "The LLM only words it. Severity comes from the black box, by rule." |
| 14 | App | Help on the machine | "New machine: how do I start it without a key? The video plays and my cab lights up the button." |
| 15 | Slide | The models | "Each model answers one question. Task time is 7.1 minutes off versus 19.8 for the planner; the twin catches 95% of unusual hours versus 81% for one rule." |
| 16 | Slide | How the AI works | "Explainable by construction: calibrated ranges, reasons in minutes, a twin that learns without retraining, and an LLM that only fills a schema." |
| 17 | App | End of shift | "My hours are verified, idle split into justified and avoidable, two lessons from my own day." |
| 18 | App | His twin learned | "Every alert compared me with myself. Tonight the twin learned from today." |
| 19 | App | Supervisor's view | "The same predictions site-wide. The Site Copilot ranks decisions with an owner and 'if nobody acts'." |
| 20 | Slide | Tech stack | "Every tool has one job: 3D on the tablet GPU, offline caching, small explainable models, voice in Hindi." |
| 21 | Slide | Design choices | "Coaching, not surveillance. A reason next to every number. Light in hand, dark in the cab." |
| 22 | Slide | Impact | "About ₹34k of fuel a year per excavator from idle alone, three interlocks from context, and a twin that beats a site rule." |
| 23 | Slide | What's next | "A 3-month pilot on one site, ten tablets, J1939 read access, against a control crew." |
| 24 | Slide | Thank you | Open for questions. The four likely ones are answered on the slide. |

## Likely questions

- **Is the data real?** Synthetic, with planted patterns, so every metric is checkable. The brief's four official rows are scored by the same models.
- **Where is the AI?** Five scikit-learn models plus a per-operator twin and the Copilot engine. The LLM (Llama 3.3 70B on Groq) only words the near-miss report into a fixed schema.
- **Why not a chatbot?** Cat already has one in the cab. We put AI where a decision is made and kept rules where safety is at stake.
- **How is it different from VisionLink?** It predicts (failure risk, fuel reserve time), explains every number, and gives the operator the result first.

## If something goes wrong

- **3D view frozen:** `←` then `→` re-enters the chapter. Still frozen: reload; `?story` returns to slide 1 and you can click any chapter number.
- **No sound in the briefing:** it falls back to the browser voice; the captions still advance.
- **No internet:** help videos need YouTube, and the 3D lighting fetches one file; everything else runs locally.
- **API down:** predictions show *Cached*. Say "this is the offline fallback the tablet uses on site."
