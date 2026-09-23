"""
Operator digital twin: each operator's own baseline, per working condition.

The unusual-behaviour question is "is this hour unusual *for this person, in these
conditions*?", not "is it above a site-wide threshold?". So the twin keeps running
mean/variance per operator and per context (task type x weather, task type, weather,
machine), and scores an hour against the most specific context that has enough history.

Rolling stats use Welford's update, so a new hour updates the twin incrementally:
no retraining. Plain statistics on purpose: every flag can be explained as
"X is N times your usual for <context> (usual Y)".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

METRICS = ["idle_min", "load_cycles", "fuel_l", "seatbelt_off_min", "harsh_swings"]
# which direction is worse (0 = tracked, never flagged: more fuel during more work isn't bad behaviour)
BAD_DIR = {"idle_min": 1, "load_cycles": -1, "fuel_l": 0, "seatbelt_off_min": 1, "harsh_swings": 1}
LABEL = {"idle_min": "Idle", "load_cycles": "Load cycles", "fuel_l": "Fuel", "seatbelt_off_min": "Seatbelt off",
         "harsh_swings": "Harsh swings"}
UNIT = {"idle_min": "min/h", "load_cycles": "/h", "fuel_l": "L/h", "seatbelt_off_min": "min/h", "harsh_swings": "/h"}
# floors on the spread so a very steady operator isn't flagged for tiny wobbles
MIN_STD = {"idle_min": 3.0, "load_cycles": 1.5, "fuel_l": 0.4, "seatbelt_off_min": 3.0, "harsh_swings": 1.0}
MIN_N = 20  # hours of history before a context is trusted
Z_FLAG = 2.5


@dataclass
class Stat:
    n: int = 0
    mean: float = 0.0
    m2: float = 0.0

    def add(self, x: float) -> None:
        self.n += 1
        d = x - self.mean
        self.mean += d / self.n
        self.m2 += d * (x - self.mean)

    @property
    def std(self) -> float:
        return (self.m2 / (self.n - 1)) ** 0.5 if self.n > 1 else 0.0


@dataclass
class Twin:
    operator_id: str
    name: str
    machine_kind: str
    # context key (e.g. ("task_weather", "Trenching", "Rainy")) -> metric -> Stat
    segments: dict = field(default_factory=dict)
    early: dict = field(default_factory=dict)  # hours 1-6, for the late-shift drift insight
    late: dict = field(default_factory=dict)   # hours 8-10
    updates_today: int = 0

    @staticmethod
    def context_keys(ctx: dict) -> list[tuple]:
        """Most specific first. The first one with enough history is used."""
        return [("task_weather", ctx["task_type"], ctx["weather"]), ("task", ctx["task_type"]),
                ("weather", ctx["weather"]), ("machine", ctx["machine_id"]), ("all",)]

    def add(self, ctx: dict, row: dict) -> None:
        for key in self.context_keys(ctx):
            seg = self.segments.setdefault(key, {m: Stat() for m in METRICS})
            for m in METRICS:
                seg[m].add(float(row[m]))
        bucket = self.early if ctx.get("hour_of_shift", 1) <= 6 else self.late if ctx.get("hour_of_shift", 1) >= 8 else None
        if bucket is not None:
            for m in METRICS:
                bucket.setdefault(m, Stat()).add(float(row[m]))

    def baseline(self, ctx: dict) -> tuple[tuple, dict]:
        for key in self.context_keys(ctx):
            seg = self.segments.get(key)
            if seg and seg["idle_min"].n >= MIN_N:
                return key, seg
        return ("all",), self.segments[("all",)]

    @property
    def hours(self) -> int:
        return self.segments[("all",)]["idle_min"].n


def describe(key: tuple) -> str:
    kind = key[0]
    if kind == "task_weather":
        return f"{key[1].lower()} in {key[2].lower()} weather"
    if kind == "task":
        return key[1].lower()
    if kind == "weather":
        return f"{key[1].lower()} weather"
    if kind == "machine":
        return "a rental with a different joystick pattern" if key[1] == "RENTAL-SAE" else f"machine {key[1]}"
    return "all your work"


class TwinNetwork:
    def __init__(self, df: pd.DataFrame):
        self.twins: dict[str, Twin] = {}
        self.site: dict[str, dict[str, Stat]] = {}  # machine kind -> metric -> Stat, for "vs site" comparisons
        for r in df.itertuples(index=False):
            self._ingest(r._asdict())

    @classmethod
    def from_csv(cls, path: Path) -> "TwinNetwork":
        return cls(pd.read_csv(path))

    def _ingest(self, r: dict) -> None:
        tw = self.twins.get(r["operator_id"])
        if tw is None:
            tw = self.twins[r["operator_id"]] = Twin(r["operator_id"], r["operator"], r["machine_kind"])
        # learns from every hour, as it would on real telemetry (no labels); rare bad hours
        # only nudge the mean, and the flag threshold is wide enough to absorb them
        tw.add(r, r)
        for scope in (tw.machine_kind, "site"):
            site = self.site.setdefault(scope, {m: Stat() for m in METRICS})
            for m in METRICS:
                site[m].add(float(r[m]))

    # ------------------------------------------------------------------ scoring
    def score(self, operator_id: str, ctx: dict, hour: dict) -> dict:
        tw = self.twins[operator_id]
        key, seg = tw.baseline(ctx)
        deviations = []
        for m in METRICS:
            if not BAD_DIR[m]:
                continue
            s = seg[m]
            std = max(s.std, MIN_STD[m])
            z = (hour[m] - s.mean) / std * BAD_DIR[m]
            if z >= 2.0:
                ratio = hour[m] / s.mean if s.mean > 0.5 else None
                deviations.append({
                    "metric": m, "z": round(z, 1), "value": round(hour[m], 1), "usual": round(s.mean, 1),
                    "reason": _reason(m, hour[m], s.mean, ratio, key),
                })
        deviations.sort(key=lambda d: -d["z"])
        unusual = any(d["z"] >= Z_FLAG for d in deviations) or len(deviations) >= 2
        return {
            "operator_id": operator_id, "unusual": unusual,
            "context": describe(key), "context_hours": seg["idle_min"].n,
            "reasons": [d["reason"] for d in deviations], "deviations": deviations,
            "twin_hours": tw.hours,
        }

    def update(self, operator_id: str, ctx: dict, hour: dict) -> dict:
        tw = self.twins[operator_id]
        before = tw.hours
        tw.add(ctx, hour)
        tw.updates_today += 1
        return {"operator_id": operator_id, "twin_hours_before": before, "twin_hours": tw.hours,
                "updates_today": tw.updates_today}

    # ------------------------------------------------------------------ profile
    def profile(self, operator_id: str) -> dict:
        tw = self.twins[operator_id]
        all_ = tw.segments[("all",)]
        kind, site = self.site[tw.machine_kind], self.site["site"]  # output per machine type; habits vs whole site
        rel = lambda m: all_[m].mean / site[m].mean if site[m].mean > 0.1 else 1.0  # noqa: E731

        axes = [
            _axis("Load cycles", "Efficiency", all_["load_cycles"].mean, kind["load_cycles"].mean, "/h", higher_better=True,
                  compare=f"{tw.machine_kind.lower()} operators"),
            _axis("Idle", "Idle discipline", all_["idle_min"].mean, site["idle_min"].mean, "min/h", higher_better=False),
            _axis("Seatbelt off", "Safety habits", all_["seatbelt_off_min"].mean, site["seatbelt_off_min"].mean, "min/h", higher_better=False),
            _axis("Harsh swings", "Smoothness", all_["harsh_swings"].mean, site["harsh_swings"].mean, "/h", higher_better=False),
        ]
        if tw.early and tw.late:
            e, l = tw.early["idle_min"].mean, tw.late["idle_min"].mean
            axes.append({"axis": "Stamina", "metric": "Idle, hours 8–10 vs 1–6", "you": round(l, 1), "site": round(e, 1),
                         "unit": "min/h", "delta_pct": round((l / e - 1) * 100) if e else 0, "good": l <= e * 1.15,
                         "compare": "your first 6 hours"})

        insights = self._insights(tw)
        by_context = []
        for key, seg in tw.segments.items():
            if key[0] == "task_weather" and seg["idle_min"].n >= MIN_N:
                by_context.append({"task_type": key[1], "weather": key[2], "hours": seg["idle_min"].n,
                                   "idle_min": round(seg["idle_min"].mean, 1),
                                   "load_cycles": round(seg["load_cycles"].mean, 1)})
        by_context.sort(key=lambda r: (r["task_type"], r["weather"]))
        return {"operator_id": operator_id, "name": tw.name, "machine_kind": tw.machine_kind,
                "hours": tw.hours, "contexts": sum(1 for k, s in tw.segments.items() if k[0] != "all" and s["idle_min"].n >= MIN_N),
                "updates_today": tw.updates_today, "axes": axes, "insights": insights, "by_context": by_context,
                "vs_site_idle": round(rel("idle_min"), 2)}

    def _insights(self, tw: Twin) -> list[dict]:
        """Contextual memory: where this operator differs from their own average."""
        all_ = tw.segments[("all",)]
        out = []
        for key, seg in tw.segments.items():
            if key[0] not in ("weather", "task", "machine") or seg["idle_min"].n < MIN_N:
                continue
            for m, words in (("idle_min", "Idle rises"), ("harsh_swings", "Harsh swings rise"), ("seatbelt_off_min", "Seatbelt-off time rises")):
                base = all_[m].mean
                if base < 0.3:
                    continue
                change = seg[m].mean / base - 1
                if change >= 0.3:
                    out.append({"kind": "watch", "strength": change,
                                "text": f"{words} {change * 100:.0f}% {_where(key)}",
                                "detail": f"{seg[m].mean:.1f} vs your usual {base:.1f} {UNIT[m]} · {seg[m].n} h of history"})
            if key[0] == "task":
                c = seg["load_cycles"].mean
                site_c = self.site[tw.machine_kind]["load_cycles"].mean
                if c >= site_c * 1.15:
                    out.append({"kind": "strength", "strength": c / site_c - 1,
                                "text": f"Strongest at {key[1].lower()}: {c:.0f} cycles/h",
                                "detail": f"site average for {tw.machine_kind.lower()}s: {site_c:.0f}/h"})
        if tw.early and tw.late:
            e, l = tw.early["idle_min"].mean, tw.late["idle_min"].mean
            if e and l / e - 1 >= 0.25:
                out.append({"kind": "watch", "strength": l / e - 1,
                            "text": f"Idle creeps up {(l / e - 1) * 100:.0f}% after hour 7",
                            "detail": f"{l:.1f} vs {e:.1f} min/h in your first 6 hours: a break before hour 7 may help"})
        out.sort(key=lambda i: -i["strength"])
        for i in out:
            i.pop("strength")
        return out[:5]


def _where(key: tuple) -> str:
    if key[0] == "weather":
        return f"in {key[1].lower()} weather"
    if key[0] == "task":
        return f"on {key[1].lower()}"
    return f"on {describe(key)}"


def _axis(metric, axis, you, site, unit, higher_better, compare="site average"):
    delta = (you / site - 1) * 100 if site > 0.1 else 0.0
    good = delta >= -10 if higher_better else delta <= 10
    return {"axis": axis, "metric": metric, "you": round(you, 1), "site": round(site, 1), "unit": unit,
            "delta_pct": round(delta), "good": good, "compare": compare}


def _reason(m, value, usual, ratio, key) -> str:
    ctx = describe(key)
    if m == "load_cycles":
        return f"Load cycles {value:.0f}/h, your usual for {ctx} is {usual:.0f}"
    if m == "seatbelt_off_min" and usual < 1:
        return f"Seatbelt off {value:.0f} min this hour; you normally keep it on for {ctx}"
    times = f"{ratio:.1f}× your usual" if ratio and ratio >= 1.5 else "above your usual"
    unit = UNIT[m] if UNIT[m].startswith("/") else f" {UNIT[m]}"
    return f"{LABEL[m]} {value:.0f}{unit} is {times} for {ctx} ({usual:.0f})"
