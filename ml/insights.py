"""
Shift Copilot (operator) and Site Copilot (supervisor): one engine that joins every data
source into a short, ranked list of actions.

Each rule reads two or more sources (task plan, forecast, site hazards, models, the
operator's digital twin, yesterday's events, fleet state) and emits an Insight only when the
combination says something no single card on the dashboard says. The models and rules
decide; nothing here is generated text.

Run `python insights.py` for the self-check: it builds the demo contexts and asserts the
expected items appear, at most 5 are shown, and every item names at least 2 sources.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import pandas as pd

from twin import TwinNetwork

SEVERITY = {"act_now": 100, "plan_ahead": 70, "heads_up": 60, "habit": 45, "well_done": 20}
TOP_N = 5
PAST_GRACE_MIN = 15  # an item whose time passed more than this long ago is dropped
DUSTY_TASKS = {"Trenching", "Earth Excavation", "Material Loading"}
TRUCK_TASKS = {"Material Loading"}  # tasks that need dumpers to keep going


def mins(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def clock(m: float) -> str:
    m = int(round(m))
    return f"{m // 60:02d}:{m % 60:02d}"


def src(kind: str, label: str) -> dict:
    return {"kind": kind, "label": label}


def insight(rule: str, subject: str, kind: str, title: str, why: str, *, sources: list[dict], at_min: int | None,
            when: str | None = None, evidence: list[tuple[str, str]] | None = None, action: dict | None = None,
            confidence: float = 1.0, task_id: str | None = None, zone: str | None = None, owner: str | None = None,
            machines: list[str] | None = None, people: list[str] | None = None, impact: str | None = None,
            delay: float = 1.0, sticky: bool = False) -> dict:
    return {
        "id": f"{rule}:{subject}", "rule": rule, "kind": kind, "title": title, "why": why,
        "when": when if when is not None else (clock(at_min) if at_min is not None else None), "at_min": at_min,
        "sources": sources, "evidence": [{"label": k, "value": v} for k, v in (evidence or [])],
        "action": action, "confidence": confidence, "task_id": task_id, "zone": zone, "owner": owner,
        "machines": machines or [], "people": people or [], "impact": impact, "delay": delay, "sticky": sticky,
    }


def urgency(at_min: int | None, now: int) -> float:
    if at_min is None or at_min <= now + 30:
        return 1.0
    return 0.85 if at_min <= now + 120 else 0.7


@dataclass
class Models:
    """The existing models, passed in from api.py so this file never loads them twice."""
    predict_task: Callable[[dict], dict]
    fuel: Callable[[dict], dict]
    health: Callable[[dict], dict]
    behaviour: Callable[[dict], dict]
    fuse_risk: Callable[[dict, dict], dict]
    twins: TwinNetwork


class Engine:
    def __init__(self, models: Models, data_dir: Path):
        self.m = models
        self.data_dir = data_dir
        self.site_day = json.loads((data_dir / "site_day.json").read_text())
        self.history = pd.read_csv(data_dir / "operator_hours.csv")
        self.inbox: list[dict] = []
        self.feedback: dict[tuple[str, str], dict[str, int]] = {}  # (rule, person) -> counts
        # messages and feedback survive an API restart (append-only logs written by api.py)
        inbox_log, feedback_log = data_dir / "inbox.jsonl", data_dir / "feedback.jsonl"
        if inbox_log.exists():
            self.inbox = [json.loads(line) for line in inbox_log.read_text(encoding="utf8").splitlines() if line.strip()]
        if feedback_log.exists():
            for line in feedback_log.read_text(encoding="utf8").splitlines():
                if line.strip():
                    fb = json.loads(line)
                    c = self.feedback.setdefault((fb["rule"], fb["person"]), {})
                    c[fb["action"]] = c.get(fb["action"], 0) + 1

    # ------------------------------------------------------------------ shared helpers
    def weather_at(self, at: int) -> dict:
        for w in self.site_day["forecast"]:
            if mins(w["from"]) <= at < mins(w["to"]):
                return w
        return self.site_day["forecast"][-1]

    def rain_window(self) -> dict | None:
        return next((w for w in self.site_day["forecast"] if w["weather"] == "Rainy"), None)

    def twin_ratio(self, op: str, key: tuple, metric: str) -> tuple[float, float, float, int] | None:
        """(ratio, segment mean, overall mean, hours) for this operator in this condition."""
        tw = self.m.twins.twins.get(op)
        if not tw or key not in tw.segments:
            return None
        seg, base = tw.segments[key][metric], tw.segments[("all",)][metric]
        if seg.n < 20 or base.mean < 0.3:
            return None
        return seg.mean / base.mean, seg.mean, base.mean, seg.n

    def belt_after_long_idle(self, op: str) -> tuple[float, float, int] | None:
        """Share of this operator's long-idle hours (30+ min) with the belt off, vs their other hours."""
        g = self.history[self.history["operator_id"] == op]
        long_idle = g["idle_min"] >= 30
        belt = g["seatbelt_off_min"] > 5
        if long_idle.sum() < 20:
            return None
        a, b = float(belt[long_idle].mean()), float(belt[~long_idle].mean())
        return (a, b, int(long_idle.sum())) if a >= 2 * max(b, 0.02) else None

    def feedback_factor(self, rule: str, person: str) -> float:
        c = self.feedback.get((rule, person))
        if not c:
            return 1.0
        total = sum(c.values())
        return 1 - 0.3 * c.get("dismissed", 0) / total

    def rank(self, items: list[dict], now: int, person: str) -> dict:
        kept = []
        for i in items:
            # a derived item naming one source is a copy of one card, not a relation: never shown.
            # Messages between people are shown as sent.
            if len(i["sources"]) < 2 and not i["rule"].startswith("from-"):
                continue
            if not i["sticky"] and i["at_min"] is not None and i["at_min"] < now - PAST_GRACE_MIN:
                continue
            reach = min(1 + 0.15 * max(len(i["machines"]) + len(i["people"]) - 1, 0), 1.6)
            i["score"] = round(SEVERITY[i["kind"]] * urgency(i["at_min"], now) * i["confidence"] * reach * i["delay"]
                               * self.feedback_factor(i["rule"], person), 1)
            kept.append(i)
        kept.sort(key=lambda i: -i["score"])
        others = [i for i in kept if i["kind"] != "well_done"]
        praise = [i for i in kept if i["kind"] == "well_done"]
        top = others[:TOP_N - 1] + (praise[:1] if praise else others[TOP_N - 1:TOP_N])
        top_ids = {i["id"] for i in top}
        return {"insights": top, "more": [i for i in kept if i["id"] not in top_ids]}

    def inbox_for(self, to: str) -> list[dict]:
        return [m for m in self.inbox if m["to"] == to]

    @staticmethod
    def forwarded(msg: dict, **overrides) -> dict:
        """A message from the other side, turned back into a full Insight (it may arrive trimmed)."""
        i = msg["insight"]
        base = insight(overrides.pop("rule"), msg["id"], i.get("kind", "heads_up"), i.get("title", ""), i.get("why", ""),
                       sources=list(i.get("sources") or []), at_min=i.get("at_min"), when=i.get("when"),
                       action=None, machines=i.get("machines"), people=i.get("people"), impact=i.get("impact"),
                       task_id=i.get("task_id"), zone=i.get("zone"), sticky=True)
        base["evidence"] = i.get("evidence") or []
        base.update(overrides)
        return base

    # ================================================================== OPERATOR
    def operator(self, p: dict) -> dict:
        now = mins(p["now"])
        op, machine, tasks = p["operator_id"], p["machine"], p["tasks"]
        sd = self.site_day
        shift_start = mins(sd["shift_start"])
        preds = {t["id"]: self.m.predict_task(t) for t in tasks}
        health = self.m.health(machine["health_day"])
        # the whole day's fuel timeline from shift start, so run-out time does not move with "now"
        fuel = self.m.fuel({"fuel_l": machine["fuel_l"], "tank_l": machine["tank_l"], "now": sd["shift_start"],
                            "reserve_l": 15, "between_tasks_lph": 5.0,
                            "tasks": [{**t, "title": t["id"]} for t in tasks]})
        out: list[dict] = []
        task_by_id = {t["id"]: t for t in tasks}

        # 1. walkaround-first: machine health x what the machine does today
        if health["level"] != "low" and health["reasons"]:
            r = health["reasons"][0]
            dusty = [t for t in tasks if t["task_type"] in DUSTY_TASKS and t["soil"] in ("Clay", "Sand")
                     and self.weather_at(mins(t["start"]))["weather"] != "Rainy"]
            dust_link = health["component"] == "Engine air intake" and dusty
            why = (f"{r['factor']} {r['value']} (usual {r['usual']}), and {dusty[0]['id']} is dusty "
                   f"{dusty[0]['task_type'].lower()} in {dusty[0]['soil'].lower()}" if dust_link
                   else f"{health['risk_pct']}% failure risk in 50 h: {r['factor']} {r['value']} (usual {r['usual']})")
            sources = [src("model", "Machine health model"), src("machine", "S·O·S oil sample")]
            if dust_link:
                sources.append(src("plan", f"Task {dusty[0]['id']}"))
            out.append(insight("walkaround-first", machine["id"], "act_now", health["action"].split(":")[0], why,
                               sources=sources, at_min=shift_start, when="Before start",
                               evidence=[("Failure risk, 50 h", f"{health['risk_pct']}%"), (r["factor"], f"{r['value']} (usual {r['usual']})")],
                               action={"label": "Hear it", "type": "play_voice"}, confidence=1.0 if dust_link else 0.85))

        # 2. refuel-slot: fuel run-out x idle windows x task starts
        if fuel["runs_out_at"]:
            out_at = mins(fuel["runs_out_at"])
            before_task = task_by_id.get(fuel["refuel_before"])
            deadline = min(out_at, mins(before_task["start"])) if before_task else out_at
            slot = next((w for w in sd["idle_windows"] if mins(w["from"]) < deadline and mins(w["to"]) >= now), None)
            evidence = [("Fuel now", f"{machine['fuel_l']:.0f} L"), ("Planned today", f"{fuel['litres_planned']:.0f} L"),
                        ("Hits reserve", f"~{fuel['runs_out_at']}")]
            sources = [src("model", "Fuel-rate model"), src("model", "Task-time model"), src("machine", "Fuel level")]
            if slot:
                sources.append(src("plan", slot["label"].capitalize()))
                why = (f"Tank hits reserve ~{fuel['runs_out_at']}, before {before_task['id']} at {before_task['start']}. "
                       f"You are parked {slot['from']}–{slot['to']} anyway" if before_task
                       else f"Tank hits reserve ~{fuel['runs_out_at']}. You are parked {slot['from']}–{slot['to']} anyway")
                out.append(insight("refuel-slot", machine["id"], "plan_ahead", f"Refuel during the {slot['label']}", why,
                                   sources=sources, at_min=mins(slot["from"]), evidence=evidence,
                                   task_id=before_task["id"] if before_task else None,
                                   action={"label": "Add refuel stop", "type": "refuel_stop"}))
            else:
                out.append(insight("refuel-slot", machine["id"], "plan_ahead",
                                   f"Refuel before {before_task['id'] if before_task else 'the next task'}",
                                   f"Tank hits reserve ~{fuel['runs_out_at']} and there is no break before then",
                                   sources=sources, at_min=deadline - 30, evidence=evidence,
                                   task_id=before_task["id"] if before_task else None,
                                   action={"label": "Add refuel stop", "type": "refuel_stop"}))

        # 3. weather-task-time: forecast at the task's time x the model's weather effect
        for t in tasks:
            w = self.weather_at(mins(t["start"]))
            pr = preds[t["id"]]
            effect = next((r["minutes"] for r in pr["reasons"] if r["factor"] == "Weather"), 0)
            if w["weather"] in ("Rainy", "Windy") and effect >= 5 and pr["p50"] - t["planner_estimate_min"] >= 8:
                out.append(insight(
                    "weather-task-time", t["id"], "heads_up",
                    f"{t['task_type']} will take ~{pr['p50']} min, not {t['planner_estimate_min']:.0f}",
                    f"{w['weather'].replace('Rainy', 'Rain')} {w['from']}–{w['to']} on {t['task_type'].lower()} adds ~{effect:.0f} min. Tell your supervisor now, not at {t['start']}",
                    sources=[src("weather", f"Forecast {w['from']}–{w['to']}"), src("model", "Task-time model"), src("plan", f"Task {t['id']}")],
                    at_min=mins(t["start"]), task_id=t["id"],
                    evidence=[("Likely", f"{pr['p10']}–{pr['p90']} min"), ("Planner", f"{t['planner_estimate_min']:.0f} min"), ("Weather effect", f"+{effect:.0f} min")],
                    action={"label": "Tell supervisor", "type": "notify_supervisor"}))

        # 4. zone-hazards: task zone x site hazards x new workers
        for t in tasks:
            hz = [h for h in sd["site_hazards"] if h["zone"] == t["zone"]]
            if len(hz) >= 2:
                out.append(insight(
                    "zone-hazards", t["id"], "heads_up",
                    f"Zone {t['zone']}: {' and '.join(h['detail'] for h in hz)} where you work",
                    f"{t['id']} starts at {t['start']} in Zone {t['zone']}. " + ". ".join(h["limit"][0].upper() + h["limit"][1:] for h in hz),
                    sources=[src("site", "Call Before u Dig / site hazards"), src("site", "New workers list"), src("plan", f"Task {t['id']}")],
                    at_min=mins(t["start"]), task_id=t["id"], zone=t["zone"],
                    evidence=[(h["detail"].capitalize(), h["limit"]) for h in hz]))

        # 5. yesterday-here: yesterday's events x today's task zones
        for e in sd["yesterday_events"]:
            if e["operator_id"] != op or e["type"] != "near_miss":
                continue
            t = next((t for t in tasks if t["zone"] == e["zone"] and mins(t["start"]) >= shift_start), None)
            if t:
                out.append(insight(
                    "yesterday-here", t["id"], "heads_up",
                    f"Yesterday's {e['text'].split(' with ')[0]} was at {e['place']}: agree hand signals first",
                    f"{e['text'].capitalize()} at {e['place']} yesterday {e['time']}, and {t['id']} is at {e['place']} today at {t['start']}",
                    sources=[src("history", "Yesterday's events"), src("plan", f"Task {t['id']}")],
                    at_min=mins(t["start"]), task_id=t["id"], zone=e["zone"], confidence=0.9))

        # 6. rain habits from the twin: belt-off and idle in rain x today's forecast
        rain = self.rain_window()
        if rain:
            belt = self.twin_ratio(op, ("weather", "Rainy"), "seatbelt_off_min")
            idle = self.twin_ratio(op, ("weather", "Rainy"), "idle_min")
            parts, ev = [], []
            if belt and belt[0] >= 1.5:
                parts.append(f"your belt-off time is {belt[0]:.1f}× your usual in rain")
                ev.append(("Belt off in rain", f"{belt[1]:.1f} vs {belt[2]:.1f} min/h ({belt[3]} h)"))
            if idle and idle[0] >= 1.3:
                parts.append(f"your idle rises {(idle[0] - 1) * 100:.0f}%")
                ev.append(("Idle in rain", f"{idle[1]:.0f} vs {idle[2]:.0f} min/h ({idle[3]} h)"))
            if parts:
                out.append(insight(
                    "rain-habits", op, "habit", f"Rain {rain['from']}–{rain['to']}: belt on, engine off while waiting",
                    "In rain, " + " and ".join(parts) + " (your own history)",
                    sources=[src("history", "Your digital twin"), src("weather", f"Forecast {rain['from']}–{rain['to']}")],
                    at_min=mins(rain["from"]), evidence=ev))

        # 7. belt-after-idle: this operator's belt/idle link x today's planned long idles
        link = self.belt_after_long_idle(op)
        long_idles = [w for w in sd["idle_windows"] if mins(w["to"]) - mins(w["from"]) >= 30]
        if link and long_idles:
            w = long_idles[0]
            yest = next((e for e in sd["yesterday_events"] if e["operator_id"] == op and e["type"] == "belt_restart"), None)
            why = (f"Your belt is off in {link[0] * 100:.0f}% of your long-idle hours, vs {link[1] * 100:.0f}% otherwise. "
                   f"The {w['label']} is a {mins(w['to']) - mins(w['from'])}-min idle")
            sources = [src("history", "Your digital twin"), src("plan", w["label"].capitalize())]
            if yest:
                why += f", and yesterday you {yest['text']} at {yest['time']}"
                sources.append(src("history", "Yesterday's events"))
            out.append(insight("belt-after-idle", op, "habit", f"Belt first when you restart at {w['to']}", why,
                               sources=sources, at_min=mins(w["to"]),
                               evidence=[("Belt off in long-idle hours", f"{link[0] * 100:.0f}% of {link[2]} h"), ("Other hours", f"{link[1] * 100:.0f}%")]))

        # 8. joystick: machine settings x operator profile x twin on that kind of machine
        if machine.get("pattern") and machine["pattern"] != p["operator"]["usual_pattern"]:
            harsh = self.twin_ratio(op, ("machine", "RENTAL-SAE"), "harsh_swings") if machine.get("rental") else None
            why = f"This machine is set to {machine['pattern']}; you run {p['operator']['usual_pattern']}"
            ev = [("Machine", machine["pattern"]), ("You", p["operator"]["usual_pattern"])]
            if harsh and harsh[0] >= 1.2:
                why += f". On rentals like this your harsh swings rise {(harsh[0] - 1) * 100:.0f}%"
                ev.append(("Harsh swings on rentals", f"{harsh[1]:.1f} vs {harsh[2]:.1f} /h ({harsh[3]} h)"))
            out.append(insight("joystick", machine["id"], "heads_up", f"Switch the joystick to {p['operator']['usual_pattern']} when you dock",
                               why, sources=[src("machine", "Machine settings (J1939)"), src("history", "Your operator profile")],
                               at_min=shift_start, when="At dock", evidence=ev, confidence=0.8))

        # 9. late-shift slump from the twin x today's heat rest
        tw = self.m.twins.twins.get(op)
        if tw and tw.early and tw.late:
            e_idle, l_idle = tw.early["idle_min"].mean, tw.late["idle_min"].mean
            hour7 = shift_start + 6 * 60
            rest = next((w for w in sd["idle_windows"] if abs(mins(w["from"]) - hour7) <= 90), None)
            if e_idle and l_idle / e_idle - 1 >= 0.25 and rest:
                out.append(insight(
                    "late-slump", op, "habit", f"Use the full {rest['label']}: engine off, shade at {rest['place']}",
                    f"Your idle creeps up {(l_idle / e_idle - 1) * 100:.0f}% after hour 7, and the {rest['label']} at {rest['from']} lands just before it",
                    sources=[src("history", "Your digital twin"), src("plan", rest["label"].capitalize())],
                    at_min=mins(rest["from"]), confidence=0.8,
                    evidence=[("Idle, hours 8–10", f"{l_idle:.1f} min/h"), ("Idle, hours 1–6", f"{e_idle:.1f} min/h")]))

        # 10. switch-off habit: this week's idle reasons x truck gap
        week = p.get("idle_week") or {}
        gap = p.get("truck_gap_min", sd["truck_gap_min"])
        if week.get("waiting_for_truck_pct", 0) >= 30 and gap > 3:
            avoidable = week.get("idle_fuel_l", 0) * week["waiting_for_truck_pct"] / 100 * (gap - 3) / gap
            out.append(insight(
                "switch-off", op, "habit", "Switch off when the next truck is more than 3 min away",
                f"{week['waiting_for_truck_pct']:.0f}% of your idle this week was waiting for trucks, and they come every ~{gap:.0f} min",
                sources=[src("model", "Idle-reason model (this week)"), src("site", "Truck schedule")],
                at_min=None, sticky=True, confidence=0.9,
                evidence=[("Avoidable diesel", f"~{avoidable:.0f} L/week"), ("Worth", f"~₹{avoidable * 90:,.0f}/week")]))

        # 11. service-window: service counter x today's planned engine hours
        due_h = machine.get("service_due_h")
        if due_h is not None and due_h >= 0:
            rest_min = sum(mins(w["to"]) - mins(w["from"]) for w in sd["idle_windows"])
            engine_h_today = (mins(sd["shift_end"]) - max(now, shift_start) - rest_min) / 60
            if due_h <= engine_h_today + 3:
                due_at = "during today's shift" if due_h <= engine_h_today else "early tomorrow"
                out.append(insight(
                    "service-window", machine["id"], "plan_ahead",
                    "Book the service for tonight" if due_at == "early tomorrow" else f"Service falls due today, book it now",
                    f"Service is due in {due_h:.0f} engine hours and today's plan runs ~{engine_h_today:.1f} h, so it falls due {due_at}",
                    sources=[src("machine", "Service counter"), src("plan", "Today's plan")],
                    at_min=mins(sd["shift_end"]), confidence=0.8,
                    action={"label": "Tell supervisor", "type": "notify_supervisor"}))

        # 12. well-done: the twin's strengths vs other operators
        prof = self.m.twins.profile(op) if tw else None
        if prof:
            good = sorted((a for a in prof["axes"] if a["good"] and a["axis"] != "Stamina"),
                          key=lambda a: -abs(a["delta_pct"]))
            if good and abs(good[0]["delta_pct"]) >= 10:
                a = good[0]
                better = "above" if a["axis"] == "Efficiency" else "better than"
                out.append(insight(
                    "well-done", op, "well_done", f"{a['axis']}: {abs(a['delta_pct'])}% {better} the {a['compare']}",
                    f"{a['metric']} {a['you']} {a['unit']} vs {a['site']} for the {a['compare']}",
                    sources=[src("history", "Your digital twin"), src("site", "Site comparison")],
                    at_min=None, sticky=True))

        # messages the supervisor sent to this operator
        for msg in self.inbox_for(op):
            kind = msg["insight"].get("kind", "heads_up")
            i = self.forwarded(msg, rule="from-supervisor", kind="act_now" if kind in ("act_now", "plan_ahead") else kind,
                               **{"from": "Supervisor"})
            i["sources"].append(src("supervisor", "Sent by your supervisor"))
            out.append(i)

        ranked = self.rank(out, now, op)
        return {"now": p["now"], "operator_id": op, **ranked,
                "summary": {"fuel_runs_out_at": fuel["runs_out_at"], "health_level": health["level"]}}

    # ================================================================== SITE
    def site(self, now_s: str = "13:30") -> dict:
        now = mins(now_s)
        sd = self.site_day
        fleet = json.loads((self.data_dir / "fleet.json").read_text())
        by_id = {m["id"]: m for m in fleet}
        names = {m["operator_id"]: m["operator"].split(" (")[0] for m in fleet}
        first = lambda n: n.split()[0]  # noqa: E731

        # per-machine context
        ctx = {}
        for m in fleet:
            remaining = [{**t, "weather": self.weather_at(mins(t["start"]))["weather"]} for t in m["tasks"]
                         if mins(t["start"]) >= now - 30]
            health = self.m.health(m["health"])
            fuel = self.m.fuel({"fuel_l": m["fuel_l"], "tank_l": m["tank_l"], "now": now_s, "reserve_l": m["tank_l"] * 0.05,
                                "between_tasks_lph": 5.0, "tasks": remaining})
            beh = self.m.behaviour(m["hour_stats"])
            tctx = {"task_type": remaining[0]["task_type"] if remaining else "Hauling",
                    "weather": self.weather_at(now)["weather"], "machine_id": m["id"], "hour_of_shift": 7}
            twin = self.m.twins.score(m["operator_id"], tctx, m["hour_stats"]) if m["operator_id"] in self.m.twins.twins else {"unusual": False, "reasons": []}
            preds = [(t, self.m.predict_task(t)) for t in remaining]
            ctx[m["id"]] = {"m": m, "health": health, "fuel": fuel, "beh": beh, "twin": twin, "remaining": remaining,
                            "preds": preds, "risk": self.m.fuse_risk(m["hour_stats"], twin)}

        out: list[dict] = []
        claimed: set[str] = set()
        idle_now = next((w for w in sd["idle_windows"] if mins(w["from"]) <= now < mins(w["to"])), None)
        idle_next = idle_now or next((w for w in sd["idle_windows"] if mins(w["from"]) >= now), None)

        # 0. critical-now: fused risk state (belt, idle, harsh swings, twin) x who is in the cab
        crit = [(mid, c) for mid, c in ctx.items() if c["risk"]["level"] == "critical"]
        if crit:
            ops = [c["m"]["operator_id"] for _, c in crit]
            restart = idle_now and mins(idle_now["to"]) - now <= 30
            out.append(insight(
                "critical-now", "+".join(mid for mid, _ in crit), "act_now",
                f"Radio {' and '.join(first(names[o]) for o in ops)} now: belt on before restarting",
                "; ".join(f"{mid}: {c['risk']['reason']}" for mid, c in crit)
                + (f". Work restarts at {idle_now['to']}" if restart else ""),
                sources=[src("machine", "Seatbelt and idle telemetry"), src("model", "Fused risk state"), src("history", "Operator twins")],
                at_min=now, owner="supervisor", machines=[mid for mid, _ in crit], people=ops, delay=1.3,
                impact="A restart without a belt, the pattern behind the brief's safety alerts",
                evidence=[(mid, c["risk"]["reason"]) for mid, c in crit],
                action={"label": "Mark radioed", "type": "ack"}))

        # 1. behaviour-wear: how the operator is working x the part that is wearing
        for mid, c in ctx.items():
            h, hs = c["health"], c["m"]["hour_stats"]
            rough = hs.get("harsh_swings", 0) >= 5 or hs.get("raised_bucket_travel", 0) >= 2
            if h["level"] in ("high", "watch") and h["component"] == "Hydraulics" and rough:
                r = h["reasons"][0]
                op = c["m"]["operator_id"]
                when = f"now, during the {idle_now['label']}" if idle_now else "at the next break"
                out.append(insight(
                    "behaviour-wear", mid, "act_now",
                    f"Check the {mid} hydraulic cooler {when}, and coach {first(names[op])} on smooth loading",
                    f"{r['factor']} {r['value']} and {h['risk_pct']}% failure risk, and {first(names[op])} had {hs['harsh_swings']} harsh swings"
                    + (" and raised-bucket travel" if hs.get("raised_bucket_travel", 0) >= 2 else "") + " this hour: the way it is being driven is heating the hydraulics",
                    sources=[src("model", "Machine health model"), src("model", "Behaviour model"), src("history", f"{first(names[op])}'s twin")],
                    at_min=now, owner="supervisor + mechanic", machines=[mid], people=[op],
                    impact=f"{mid} risk stays at {h['risk_pct']}% while the cause continues",
                    evidence=[(r["factor"], f"{r['value']} (usual {r['usual']})"), ("Harsh swings this hour", str(hs["harsh_swings"])),
                              ("Fault codes", ", ".join(f["code"] for f in c["m"]["faults"]) or "none")]))
                claimed.add(mid)

        # 2. rental-call: rental owner x overdue service x health risk
        for mid, c in ctx.items():
            m, h = c["m"], c["health"]
            if mid in claimed or m["owner"]["type"] != "rental":
                continue
            if m["service_due_h"] < 0 or h["level"] == "high":
                nxt = c["remaining"][0] if c["remaining"] else None
                why = (f"Service {-m['service_due_h']} h overdue" if m["service_due_h"] < 0 else f"Service due in {m['service_due_h']} h")
                why += f" and {h['risk_pct']}% failure risk ({(h['component'] or 'general').lower()})"
                if nxt:
                    why += f"; it has {nxt['task_type'].lower()} at {nxt['start']}"
                out.append(insight(
                    "rental-call", mid, "act_now", f"Call {m['owner']['name']} about {mid}: service or swap",
                    why + ". It is a rental, so the fix is a call, not our workshop",
                    sources=[src("model", "Machine health model"), src("machine", "Service counter"), src("site", "Rental contract")],
                    at_min=now, owner="supervisor", machines=[mid], impact=f"{mid} may fail mid-task", delay=1.1,
                    evidence=[("Service", f"{m['service_due_h']} h"), ("Failure risk, 50 h", f"{h['risk_pct']}%")],
                    action={"label": "Mark called", "type": "ack"}))
                claimed.add(mid)

        # 3. pull-machine: high risk x remaining work x machines it keeps supplied
        pulled: list[str] = []
        for mid, c in ctx.items():
            m, h = c["m"], c["health"]
            if mid in claimed or h["level"] != "high":
                continue
            r = h["reasons"][0] if h["reasons"] else None
            serves = [s for s in m["serves"] if s in ctx]
            if not (serves or c["remaining"]):
                continue
            active_dumpers = [d for d, dc in ctx.items() if set(dc["m"]["serves"]) & set(serves)]
            gap = sd["truck_gap_min"]
            impact = (f"Truck gap at {', '.join(serves)} goes from ~{gap} to ~{gap * len(active_dumpers) / max(len(active_dumpers) - 1, 1):.0f} min"
                      if serves else f"{mid} may fail during {c['remaining'][0]['task_type'].lower()}")
            faults = [f for f in m["faults"] if f["severity"] == "high"]
            why = f"{h['risk_pct']}% failure risk: {r['factor']} {r['value']} (usual {r['usual']})" if r else f"{h['risk_pct']}% failure risk"
            if faults:
                why += f", and fault {faults[0]['code']} ({faults[0]['text'].lower()}) is active"
            sources = [src("model", "Machine health model"), src("machine", "Fault codes" if faults else "Sensors")]
            if serves:
                sources.append(src("plan", "Dumper assignments"))
            out.append(insight(
                "pull-machine", mid, "act_now",
                f"Pull {mid} before the afternoon haul" if serves else f"Pull {mid} before {c['remaining'][0]['task_type'].lower()}",
                why, sources=sources, at_min=now, owner="mechanic", machines=[mid] + serves, impact=impact, delay=1.2,
                evidence=[("Failure risk, 50 h", f"{h['risk_pct']}%")] + ([(r["factor"], f"{r['value']} (usual {r['usual']})")] if r else []),
                action={"label": "Assign mechanic", "type": "assign"}))
            pulled.append(mid)
            claimed.add(mid)

        # 4. truck-rebalance: a pulled dumper x which served machines still need trucks
        for mid in pulled:
            serves = ctx[mid]["m"]["serves"]
            if not serves:
                continue
            others = [d for d, dc in ctx.items() if d != mid and set(dc["m"]["serves"]) & set(serves) and d not in claimed]
            needs = [s for s in serves if any(t["task_type"] in TRUCK_TASKS for t in ctx[s]["remaining"])]
            no_need = [s for s in serves if s not in needs]
            if others and needs:
                why = f"With {mid} out, {others[0]} is the only dumper left. " + ", ".join(
                    f"{s} has {next(t for t in ctx[s]['remaining'] if t['task_type'] in TRUCK_TASKS)['task_type'].lower()} at "
                    f"{next(t for t in ctx[s]['remaining'] if t['task_type'] in TRUCK_TASKS)['start']}" for s in needs)
                if no_need:
                    why += "; " + ", ".join(f"{s} is {ctx[s]['remaining'][0]['task_type'].lower() if ctx[s]['remaining'] else 'idle'}" for s in no_need) + " and needs no trucks"
                out.append(insight(
                    "truck-rebalance", mid, "plan_ahead", f"Send {others[0]} to {needs[0]} first",
                    why, sources=[src("plan", "Dumper assignments"), src("plan", "Afternoon tasks")],
                    at_min=now, owner="supervisor", machines=[others[0]] + needs, confidence=0.9))

        # 5. bowser-run: every machine's fuel timeline x the break x where they are
        low = sorted(((mid, mins(c["fuel"]["runs_out_at"])) for mid, c in ctx.items()
                      if c["fuel"]["runs_out_at"] and mid not in pulled), key=lambda x: x[1])
        if low:
            route_zones = {ctx[mid]["m"]["zone"] for mid, _ in low} | {"A", "B"}
            top_ups = [mid for mid, c in ctx.items() if mid not in dict(low) and mid not in pulled
                       and c["m"]["fuel_l"] / c["m"]["tank_l"] < 0.4 and c["m"]["zone"] in route_zones]
            stops = [mid for mid, _ in low] + top_ups
            first_mid, first_out = low[0]
            nxt = ctx[first_mid]["remaining"][0] if ctx[first_mid]["remaining"] else None
            slot = idle_next if idle_next and mins(idle_next["from"]) < first_out else None
            why = f"{first_mid} hits reserve ~{clock(first_out)}" + (f", before its {nxt['task_type'].lower()} at {nxt['start']}" if nxt else "")
            if slot:
                why += f"; the site is parked until {slot['to']}"
            full_pct = {t: ctx[t]["m"]["fuel_l"] / ctx[t]["m"]["tank_l"] * 100 for t in top_ups}
            if top_ups:
                levels = ", ".join(f"{t} is at {full_pct[t]:.0f}%" for t in top_ups)
                why += f"; {levels} on the same route. One run instead of {len(stops)}"
            out.append(insight(
                "bowser-run", "+".join(stops), "act_now" if first_out - now <= 120 else "plan_ahead",
                f"Bowser: {', then '.join(stops)}" + (f", during the {slot['label']}" if slot else ""),
                why, sources=[src("model", "Fuel-rate model"), src("model", "Task-time model"), src("machine", "Fuel levels")]
                + ([src("plan", slot["label"].capitalize())] if slot else []),
                at_min=now if slot is idle_now else (mins(slot["from"]) if slot else first_out - 45),
                owner="bowser driver", machines=stops, impact=f"{first_mid} stops ~{clock(first_out)}",
                evidence=[(mid, f"reserve ~{clock(t)}") for mid, t in low] + [(t, f"{full_pct[t]:.0f}% full") for t in top_ups],
                action={"label": "Assign bowser", "type": "assign"}))

        # 6. schedule-slip: forecast x every remaining task x the task-time model
        slips = []
        for mid, c in ctx.items():
            for t, pr in c["preds"]:
                over = pr["p50"] - t["planner_estimate_min"]
                if over > 0:
                    slips.append((over, mid, t, pr))
        total_slip = sum(s[0] for s in slips)
        if total_slip >= 15:
            slips.sort(key=lambda s: -s[0])
            over, mid, t, pr = next((s for s in slips if s[1] in claimed), slips[0])
            rain = self.rain_window()
            wet = sum(1 for _, _, tt, _ in slips if tt["weather"] == "Rainy")
            why = f"{len(slips)} tasks run over plan by ~{total_slip:.0f} min in total"
            if rain and wet:
                why += f" ({wet} of them in the {rain['from']}–{rain['to']} rain)"
            why += f". {mid}'s {t['task_type'].lower()} is the biggest: ~{pr['p50']} min vs {t['planner_estimate_min']:.0f} planned"
            out.append(insight(
                "schedule-slip", "site", "heads_up", f"Afternoon runs ~{total_slip:.0f} min over: move {mid}'s {t['task_type'].lower()} to tomorrow morning",
                why, sources=[src("weather", "Forecast"), src("model", "Task-time model"), src("plan", "Afternoon tasks")],
                at_min=now, owner="supervisor", machines=sorted({s[1] for s in slips}), confidence=0.9,
                evidence=[(f"{s[1]} {s[2]['task_type'].lower()}", f"+{s[0]:.0f} min") for s in slips[:4]]))

        # 7. zone-spotter: hazards x new workers x active machines x yesterday's events
        for zone in sorted({h["zone"] for h in sd["site_hazards"]}):
            hz = [h for h in sd["site_hazards"] if h["zone"] == zone]
            yest = [e for e in sd["yesterday_events"] if e["zone"] == zone and e["type"] == "near_miss"]
            active = [mid for mid, c in ctx.items() if c["m"]["zone"] == zone]
            if len(hz) + len(yest) >= 2 and active:
                out.append(insight(
                    "zone-spotter", zone, "heads_up", f"Put a spotter in Zone {zone} while {', '.join(active)} works there",
                    "; ".join(h["detail"].capitalize() for h in hz) + (f"; near-miss there yesterday" if yest else ""),
                    sources=[src("site", "Site hazards"), src("site", "New workers list"), src("plan", "Machine positions")],
                    at_min=now, owner="safety officer", machines=active, zone=zone, confidence=0.85))

        # 8. targeted-talk: belt violations by person x their twin
        viol = sorted(((c["m"]["operator_id"], c["m"]["seatbelt_violations"]) for c in ctx.values() if c["m"]["seatbelt_violations"]),
                      key=lambda x: -x[1])
        total_v = sum(v for _, v in viol)
        if total_v >= 4:
            few = []
            for op, v in viol:
                few.append((op, v))
                if sum(x for _, x in few) / total_v >= 0.7:
                    break
            if len(few) <= 2:
                n = sum(v for _, v in few)
                extra = ""
                rain = self.rain_window()
                for o, _ in few:
                    belt_rain = self.twin_ratio(o, ("weather", "Rainy"), "seatbelt_off_min")
                    if belt_rain and belt_rain[0] >= 1.5 and rain and now < mins(rain["to"]):
                        extra = f". {first(names[o])}'s belt-off time is {belt_rain[0]:.1f}× higher in rain, and it rains until {rain['to']}"
                        break
                out.append(insight(
                    "targeted-talk", "belt", "plan_ahead",
                    f"5-minute belt talk with {' and '.join(first(names[o]) for o, _ in few)} only",
                    f"They account for {n} of today's {total_v} belt violations{extra}. A site-wide talk would miss the point",
                    sources=[src("machine", "Seatbelt telemetry"), src("history", "Operator twins")],
                    at_min=now + 30, owner="supervisor", people=[o for o, _ in few], confidence=0.9,
                    evidence=[(names[o], f"{v} violations") for o, v in viol]))

        # 9. mentor-pair: a struggling operator x a steady one on similar work
        steady = sorted((c for c in ctx.values() if c["m"]["seatbelt_violations"] == 0 and c["health"]["level"] == "low"
                         and c["m"]["kind"].startswith("Excavator")), key=lambda c: c["m"]["idle_min"]["waste"])
        for c in ctx.values():
            m = c["m"]
            if (m["seatbelt_violations"] >= 3 or m["idle_min"]["waste"] >= 60) and steady and steady[0]["m"]["id"] != m["id"]:
                mentor = steady[0]["m"]
                task_word = c["remaining"][0]["task_type"].lower() if c["remaining"] else "work"
                out.append(insight(
                    "mentor-pair", m["operator_id"], "plan_ahead", f"Pair {first(names[m['operator_id']])} with {first(names[mentor['operator_id']])} for tomorrow's {task_word}",
                    f"{first(names[m['operator_id']])}: {m['seatbelt_violations']} belt violations and {m['idle_min']['waste']} min avoidable idle today. "
                    f"{first(names[mentor['operator_id']])} ({mentor['id']}): 0 violations, {mentor['idle_min']['waste']} min avoidable idle",
                    sources=[src("machine", "Today's telemetry"), src("history", "Operator twins")],
                    at_min=mins(sd["shift_end"]), owner="supervisor", people=[m["operator_id"], mentor["operator_id"]], confidence=0.8))
                break

        # 10. service-tonight: service counters x health watch items x what is already handled
        jobs: dict[str, list[str]] = {}
        for mid, c in ctx.items():
            if mid in pulled or mid in claimed:
                continue
            if 0 <= c["m"]["service_due_h"] <= 24:
                jobs.setdefault(mid, []).append(f"service due in {c['m']['service_due_h']} h")
            if c["health"]["level"] == "watch":
                jobs.setdefault(mid, []).append(c["health"]["action"].split(":")[0].lower())
        tonight = [(mid, " and ".join(w)) for mid, w in jobs.items()]
        if tonight:
            out.append(insight(
                "service-tonight", "site", "plan_ahead", "Tonight's workshop list: " + ", ".join(mid for mid, _ in tonight),
                "; ".join(f"{mid}: {what}" for mid, what in tonight)
                + (". Batch them after the shift, not mid-task" if len(tonight) > 1 else ". Do it after the shift, not mid-task"),
                sources=[src("machine", "Service counters"), src("model", "Machine health model")],
                at_min=mins(sd["shift_end"]), owner="mechanic", machines=[mid for mid, _ in tonight], confidence=0.8))

        # 11. messages from operators
        for msg in self.inbox_for("supervisor"):
            who = names.get(msg["from"], msg["from"])
            i = self.forwarded(msg, rule="from-operator", kind="heads_up", owner="supervisor", at_min=now,
                               title=f"{first(who)}: {msg['insight'].get('title', '')}", people=[msg["from"]], **{"from": who})
            i["sources"].append(src("operator", f"Sent by {first(who)}"))
            out.append(i)

        # 12. well-done: safest, least wasteful, steadiest operator today
        def merit(c):
            m = c["m"]
            strength = any(i["kind"] == "strength" for i in self.m.twins.profile(m["operator_id"])["insights"]) if m["operator_id"] in self.m.twins.twins else False
            return (m["seatbelt_violations"] == 0) * 3 + (c["health"]["level"] == "low") + strength * 2 - m["idle_min"]["waste"] / 30
        best = max(ctx.values(), key=merit)
        bm = best["m"]
        if bm["seatbelt_violations"] == 0:
            prof = self.m.twins.profile(bm["operator_id"])
            strength = next((i for i in prof["insights"] if i["kind"] == "strength"), None)
            why = f"0 belt violations, {bm['idle_min']['waste']} min avoidable idle, {best['health']['risk_pct']}% machine risk"
            if strength:
                why += f". {strength['text']} ({strength['detail']})"
            out.append(insight(
                "well-done", bm["operator_id"], "well_done", f"Thank {first(names[bm['operator_id']])} ({bm['id']})", why,
                sources=[src("machine", "Today's telemetry"), src("history", f"{first(names[bm['operator_id']])}'s twin")],
                at_min=None, sticky=True, owner="supervisor", people=[bm["operator_id"]]))

        ranked = self.rank(out, now, "supervisor")
        # one line for the whole site
        critical = [mid for mid, c in ctx.items() if c["risk"]["level"] == "critical"]
        act_machines = sorted({mid for i in ranked["insights"] if i["kind"] == "act_now" for mid in i["machines"]})
        level = "critical" if critical else "caution" if act_machines else "safe"
        parts = [f"{len(act_machines)} machines need action"] if act_machines else ["No machine needs action"]
        if critical:
            parts.append(f"critical: {', '.join(critical)}")
        if total_slip >= 15:
            parts.append(f"afternoon ~{total_slip:.0f} min over plan")
        return {"now": now_s, **ranked,
                "status": {"level": level, "text": " · ".join(parts), "critical": critical, "machines": act_machines}}


# Ravi's demo day, as the operator app sends it (mirrors frontend/src/data/demo.ts). Self-check only.
DEMO_PAYLOAD = {
    "operator_id": "OP1001", "now": "07:00",
    "operator": {"name": "Ravi Kumar", "usual_pattern": "ISO", "skill": "Intermediate"},
    "machine": {"id": "EXC001", "fuel_l": 78, "tank_l": 345, "pattern": "SAE", "rental": True, "service_due_h": 12,
                "health_day": {"hyd_oil_temp_max": 79, "coolant_temp_max": 88, "engine_load_pct": 62, "hrs_since_oil_change": 210,
                               "sos_iron_ppm": 29, "sos_silicon_ppm": 24, "sos_soot_pct": 0.7, "sos_water_pct": 0.04,
                               "idle_pct": 30, "fault_codes_7d": 1, "machine_age_yrs": 4}},
    "tasks": [
        {"id": "T101", "title": "Trenching for OFC duct, Zone B", "zone": "B", "start": "07:30", "task_type": "Trenching",
         "weather": "Cloudy", "operator_skill": "Intermediate", "soil": "Clay", "machine_age_yrs": 4, "ambient_temp_c": 31,
         "volume_m3": 110, "planner_estimate_min": 50},
        {"id": "T102", "title": "Load spoil into dumpers, Bay 2", "zone": "A", "start": "09:00", "task_type": "Material Loading",
         "weather": "Sunny", "operator_skill": "Intermediate", "soil": "Loam", "machine_age_yrs": 4, "ambient_temp_c": 36,
         "volume_m3": 180, "planner_estimate_min": 50},
        {"id": "T103", "title": "Grade shoulder, chainage 4+200", "zone": "C", "start": "14:30", "task_type": "Grading",
         "weather": "Rainy", "operator_skill": "Intermediate", "soil": "Loam", "machine_age_yrs": 4, "ambient_temp_c": 29,
         "volume_m3": 120, "planner_estimate_min": 42},
    ],
    "truck_gap_min": 6,
    "idle_week": {"waiting_for_truck_pct": 44, "waste_pct": 15, "idle_fuel_l": 41.6},
}


if __name__ == "__main__":
    # self-check against the demo day
    import api  # loads the models and builds the engine

    e = api.engine
    op = e.operator(DEMO_PAYLOAD)
    ids = [i["rule"] for i in op["insights"] + op["more"]]
    for rule in ("walkaround-first", "refuel-slot", "weather-task-time", "zone-hazards", "belt-after-idle", "joystick", "rain-habits"):
        assert rule in ids, f"operator: expected {rule}, got {ids}"
    assert len(op["insights"]) <= TOP_N
    assert all(len(i["sources"]) >= 2 for i in op["insights"] + op["more"] if not i["rule"].startswith("from-"))
    print("operator 07:00:", [i["title"] for i in op["insights"]])
    later = e.operator({**DEMO_PAYLOAD, "now": "12:30"})
    assert later["insights"][0]["rule"] == "refuel-slot", later["insights"][0]
    print("operator 12:30:", [i["title"] for i in later["insights"]])

    site = e.site("13:30")
    got = {(i["rule"], i["id"].split(":", 1)[1]) for i in site["insights"] + site["more"]}
    for rule, subj in (("pull-machine", "DT-03"), ("rental-call", "BHL-11"), ("behaviour-wear", "WHL002")):
        assert (rule, subj) in got, f"site: expected {rule} for {subj}, got {sorted(got)}"
    assert any(r == "bowser-run" and "EXC001" in s for r, s in got), got
    assert len(site["insights"]) <= TOP_N and all(i["owner"] for i in site["insights"])
    assert all(len(i["sources"]) >= 2 for i in site["insights"] + site["more"] if not i["rule"].startswith("from-"))
    # a message each way, as the apps send them
    e.inbox.append({"id": "t1", "to": "supervisor", "from": "OP1001", "insight": op["insights"][1]})
    e.inbox.append({"id": "t2", "to": "OP1001", "from": "supervisor", "insight": {"title": "Bowser at 13:00", "kind": "plan_ahead", "sources": []}})
    assert any(i["rule"] == "from-operator" for i in e.site("13:30")["more"] + e.site("13:30")["insights"])
    assert any(i["rule"] == "from-supervisor" for i in e.operator(DEMO_PAYLOAD)["insights"] + e.operator(DEMO_PAYLOAD)["more"])
    e.inbox.clear()
    print("site 13:30:", site["status"]["text"])
    for i in site["insights"]:
        print("  ", i["kind"], "|", i["title"], "|", i["owner"])
    print("self-check passed")
