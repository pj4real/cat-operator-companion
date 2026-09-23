"""
Synthetic data generator for the Cat Operator Companion.

We only got 4 telemetry rows and 5 task rows from the problem statement, so we
generate realistic history with the same columns (plus a few more). Every
pattern below is planted on purpose, so the models have something real to learn
and we can explain exactly why they predict what they predict.

Run:  python generate_data.py
Out:  data/tasks.csv, data/idle_windows.csv, data/shift_hours.csv,
      data/machine_days.csv, data/fleet.json, data/operator_hours.csv
"""
import json

import numpy as np
import pandas as pd
from pathlib import Path

rng = np.random.default_rng(42)
OUT = Path(__file__).parent / "data"
OUT.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# 1. TASKS  (extends the "Task ID / Task Type / Weather / Skill / Age" table)
# ---------------------------------------------------------------------------
TASK_TYPES = {
    # base minutes per 100 m3 of work for an expert on a new machine in sun
    "Earth Excavation": 55,
    "Trenching": 42,
    "Material Loading": 26,
    "Grading": 34,
    "Demolition": 80,
}
WEATHER = ["Sunny", "Cloudy", "Rainy", "Windy"]
SKILL = {"Beginner": 1.35, "Intermediate": 1.10, "Expert": 0.95}
SOIL = {"Sand": 0.95, "Loam": 1.0, "Clay": 1.12, "Rock": 1.28}


def weather_factor(task, weather):
    if weather == "Rainy" and task in ("Trenching", "Grading", "Earth Excavation"):
        return 1.16
    if weather == "Windy" and task == "Demolition":
        return 1.17
    if weather == "Rainy":
        return 1.06
    return 1.0


rows = []
for i in range(3000):
    task = rng.choice(list(TASK_TYPES))
    weather = rng.choice(WEATHER, p=[0.45, 0.25, 0.2, 0.1])
    skill = rng.choice(list(SKILL), p=[0.25, 0.45, 0.30])
    soil = rng.choice(list(SOIL), p=[0.25, 0.35, 0.28, 0.12])
    age = int(rng.integers(1, 11))
    temp = float(np.round(rng.normal(33, 5), 1))
    volume = float(np.round(rng.uniform(40, 220), 0))

    true_min = TASK_TYPES[task] * volume / 100
    true_min *= SKILL[skill] * weather_factor(task, weather) * SOIL[soil]
    true_min *= 1 + 0.02 * age
    if temp > 38:
        true_min *= 1.08
    actual = true_min * rng.lognormal(0, 0.08)

    # the planner uses a rule of thumb that ignores skill and weather,
    # which is exactly the bias we see in the sample table (beginner +40%)
    planner = TASK_TYPES[task] * volume / 100 * 1.05 * rng.normal(1, 0.05)

    rows.append(dict(task_id=f"T{i+1:04d}", task_type=task, weather=weather,
                     operator_skill=skill, soil=soil, machine_age_yrs=age,
                     ambient_temp_c=temp, volume_m3=volume,
                     planner_estimate_min=round(planner, 1),
                     actual_min=round(actual, 1)))

tasks = pd.DataFrame(rows)
# keep the 5 official sample rows at the top so judges recognise them
sample = pd.DataFrame([
    ["T001", "Earth Excavation", "Sunny", "Expert", "Loam", 2, 32, 105, 60, 58],
    ["T002", "Trenching", "Rainy", "Intermediate", "Clay", 4, 27, 100, 45, 52],
    ["T003", "Material Loading", "Cloudy", "Beginner", "Sand", 3, 30, 110, 30, 42],
    ["T004", "Grading", "Sunny", "Expert", "Loam", 5, 34, 100, 35, 33],
    ["T005", "Demolition", "Windy", "Intermediate", "Rock", 6, 31, 105, 90, 105],
], columns=tasks.columns)
tasks = pd.concat([sample, tasks], ignore_index=True)

# fuel burn rate (L/h) while doing the task, Cat 320 class. Planted: harder soil and
# less skill burn more (more passes, more throttle), older machines and heat burn more.
FUEL_BASE = {"Earth Excavation": 16, "Trenching": 14, "Material Loading": 15, "Grading": 11, "Demolition": 18}
FUEL_SOIL = {"Sand": 0.96, "Loam": 1.0, "Clay": 1.08, "Rock": 1.15}
FUEL_SKILL = {"Beginner": 1.12, "Intermediate": 1.04, "Expert": 0.97}


def fuel_rate(r):
    lph = FUEL_BASE[r.task_type] * FUEL_SOIL[r.soil] * FUEL_SKILL[r.operator_skill]
    lph *= 1 + 0.015 * r.machine_age_yrs
    if r.ambient_temp_c > 38:
        lph *= 1.05
    return round(lph * rng.lognormal(0, 0.06), 2)


tasks["fuel_lph"] = [fuel_rate(r) for r in tasks.itertuples()]
tasks.to_csv(OUT / "tasks.csv", index=False)

# ---------------------------------------------------------------------------
# 2. IDLE WINDOWS  (5-minute windows where the engine is on but no work done)
#    label = WHY the machine is idle. Only "waste" should be flagged.
# ---------------------------------------------------------------------------
IDLE_CLASSES = ["warm_up", "cool_down", "waiting_for_truck", "heat_rest", "waste"]
idle_rows = []
for _ in range(4000):
    label = rng.choice(IDLE_CLASSES, p=[0.12, 0.10, 0.38, 0.12, 0.28])
    mins_since_start = rng.uniform(20, 600)
    mins_to_shutdown = rng.uniform(20, 600)
    hour = rng.uniform(7, 19)
    ambient = rng.normal(32, 5)
    truck_eta = rng.uniform(5, 25)
    hyd_temp = rng.normal(70, 6)
    rpm = rng.normal(1000, 60)
    seat_occupied = 1
    ac_on = int(rng.random() < 0.5)

    if label == "warm_up":
        mins_since_start = rng.uniform(0, 12); hyd_temp = rng.normal(35, 8); rpm = rng.normal(1150, 80)
    elif label == "cool_down":
        mins_to_shutdown = rng.uniform(0, 6); hyd_temp = rng.normal(78, 5)
    elif label == "waiting_for_truck":
        truck_eta = rng.uniform(0.5, 6)
    elif label == "heat_rest":
        ambient = rng.normal(40, 2); ac_on = 1; hour = rng.uniform(12, 15.5)
        seat_occupied = int(rng.random() < 0.8)
    else:  # waste: engine on, no reason, often operator away from seat
        seat_occupied = int(rng.random() < 0.4); truck_eta = rng.uniform(8, 30)

    idle_rows.append(dict(
        mins_since_engine_start=round(mins_since_start, 1),
        mins_to_shift_end=round(mins_to_shutdown, 1),
        hour_of_day=round(hour, 2), ambient_temp_c=round(ambient, 1),
        next_truck_eta_min=round(truck_eta, 1), hyd_oil_temp_c=round(hyd_temp, 1),
        engine_rpm=round(rpm), seat_occupied=seat_occupied, ac_on=ac_on,
        label=label))
pd.DataFrame(idle_rows).to_csv(OUT / "idle_windows.csv", index=False)

# ---------------------------------------------------------------------------
# 3. SHIFT HOURS  (extends the official telemetry table, 1 row per hour)
#    used for "unusual behaviour" detection
# ---------------------------------------------------------------------------
hour_rows = []
for day in range(90):
    for h in range(10):
        anomaly = rng.random() < 0.06
        fuel = rng.normal(5.5, 0.6)
        cycles = rng.normal(11, 2)
        idle = rng.normal(18, 6)
        belt_off_min = 0.0
        harsh_swings = rng.poisson(1)
        raised_bucket_travel = rng.poisson(0.3)
        if anomaly:
            kind = rng.choice(["idle", "unsafe", "belt"])
            if kind == "idle":
                idle = rng.normal(50, 6); cycles = rng.normal(2, 1); fuel = rng.normal(3.6, 0.4)
            elif kind == "unsafe":
                harsh_swings = rng.poisson(9); raised_bucket_travel = rng.poisson(4)
            else:
                belt_off_min = rng.uniform(20, 55); idle = rng.normal(45, 8); cycles = rng.normal(3, 1)
        hour_rows.append(dict(day=day, hour=7 + h,
                              fuel_l=round(max(fuel, 0.5), 2),
                              load_cycles=int(max(cycles, 0)),
                              idle_min=round(float(np.clip(idle, 0, 60)), 1),
                              seatbelt_off_min=round(belt_off_min, 1),
                              harsh_swings=int(harsh_swings),
                              raised_bucket_travel=int(raised_bucket_travel),
                              planted_anomaly=int(anomaly)))
pd.DataFrame(hour_rows).to_csv(OUT / "shift_hours.csv", index=False)

# ---------------------------------------------------------------------------
# 4. MACHINE DAYS  (daily health snapshot: sensors + S·O·S oil sample)
#    label = did a component fail within the next 50 engine hours?
#    Planted failure modes: dust ingress, coolant in oil, hydraulic overheating,
#    overdue oil change. Healthy machines still fail sometimes (3%).
# ---------------------------------------------------------------------------
day_rows = []
for _ in range(3000):
    age = int(rng.integers(1, 11))
    r = dict(
        hyd_oil_temp_max=rng.normal(78, 5), coolant_temp_max=rng.normal(88, 3),
        engine_load_pct=rng.normal(62, 10), hrs_since_oil_change=rng.uniform(0, 480),
        sos_iron_ppm=rng.normal(18, 5), sos_silicon_ppm=rng.normal(9, 2.5),
        sos_soot_pct=rng.normal(0.8, 0.25), sos_water_pct=abs(rng.normal(0.05, 0.03)),
        idle_pct=rng.normal(35, 10), fault_codes_7d=rng.poisson(0.5), machine_age_yrs=age,
    )
    p_fail = 0.03 + 0.004 * age
    if rng.random() < 0.16:
        mode = rng.choice(["dust", "coolant", "hyd_heat", "overdue"])
        if mode == "dust":
            r["sos_silicon_ppm"] = rng.uniform(22, 45); r["sos_iron_ppm"] = rng.uniform(28, 60)
        elif mode == "coolant":
            r["sos_water_pct"] = rng.uniform(0.25, 0.8); r["coolant_temp_max"] = rng.uniform(96, 106)
        elif mode == "hyd_heat":
            r["hyd_oil_temp_max"] = rng.uniform(90, 102); r["fault_codes_7d"] += rng.poisson(2)
        else:
            r["hrs_since_oil_change"] = rng.uniform(520, 720); r["sos_soot_pct"] = rng.uniform(1.6, 3.0)
        p_fail = 0.65 + 0.02 * age
    r["fails_within_50h"] = int(rng.random() < p_fail)
    day_rows.append({k: (round(float(v), 2) if not isinstance(v, int) else v) for k, v in r.items()})
pd.DataFrame(day_rows).to_csv(OUT / "machine_days.csv", index=False)

# ---------------------------------------------------------------------------
# 5. FLEET SNAPSHOT  (today on the NH-48 site; the API scores it with the models)
# ---------------------------------------------------------------------------
HEALTHY = dict(hyd_oil_temp_max=79, coolant_temp_max=88, engine_load_pct=64, hrs_since_oil_change=210,
               sos_iron_ppm=17, sos_silicon_ppm=8, sos_soot_pct=0.7, sos_water_pct=0.04,
               idle_pct=30, fault_codes_7d=0)


def task(t, weather, soil, skill, age, temp, vol, plan, start, title=""):
    return dict(task_type=t, weather=weather, operator_skill=skill, soil=soil, machine_age_yrs=age,
                ambient_temp_c=temp, volume_m3=vol, planner_estimate_min=plan, start=start, title=title or t)


fleet = [
    dict(id="EXC001", make="Cat", model="320", kind="Excavator", operator="Ravi Kumar (OP1001)", zone="B",
         x=38, y=55, hours=1530.2, tank_l=345, fuel_l=31, working_h=6.1, service_due_h=12, cycles=184, payload_t=0,
         idle_min={"waiting_for_truck": 62, "heat_rest": 40, "warm_up": 9, "cool_down": 4, "waste": 33},
         seatbelt_violations=2,
         health={**HEALTHY, "sos_silicon_ppm": 24, "sos_iron_ppm": 29, "machine_age_yrs": 4, "fault_codes_7d": 1},
         hour_stats=dict(fuel_l=3.8, load_cycles=2, idle_min=55, seatbelt_off_min=30, harsh_swings=1, raised_bucket_travel=0),
         faults=[{"code": "E0171-1", "severity": "low", "text": "Air filter restriction, early"}],
         tasks=[task("Grading", "Rainy", "Loam", "Intermediate", 4, 29, 120, 42, "14:30", "T103 Grade shoulder")]),
    dict(id="EXC004", make="Cat", model="320", kind="Excavator", operator="Suresh Pal (OP1007)", zone="C",
         x=70, y=30, hours=4210.8, tank_l=345, fuel_l=205, working_h=7.4, service_due_h=140, cycles=231, payload_t=0,
         idle_min={"waiting_for_truck": 38, "heat_rest": 40, "warm_up": 8, "cool_down": 5, "waste": 12},
         seatbelt_violations=0,
         health={**HEALTHY, "machine_age_yrs": 7},
         hour_stats=dict(fuel_l=5.6, load_cycles=12, idle_min=16, seatbelt_off_min=0, harsh_swings=1, raised_bucket_travel=0),
         faults=[],
         tasks=[task("Earth Excavation", "Sunny", "Clay", "Expert", 7, 35, 200, 110, "13:40")]),
    dict(id="WHL002", make="Cat", model="950 GC", kind="Wheel loader", operator="Anil Yadav (OP1012)", zone="A",
         x=18, y=28, hours=2875.0, tank_l=300, fuel_l=164, working_h=6.8, service_due_h=48, cycles=312, payload_t=1180,
         idle_min={"waiting_for_truck": 55, "heat_rest": 40, "warm_up": 10, "cool_down": 6, "waste": 21},
         seatbelt_violations=1,
         health={**HEALTHY, "hyd_oil_temp_max": 96, "fault_codes_7d": 3, "machine_age_yrs": 5},
         hour_stats=dict(fuel_l=6.4, load_cycles=14, idle_min=12, seatbelt_off_min=0, harsh_swings=7, raised_bucket_travel=3),
         faults=[{"code": "E0600-2", "severity": "high", "text": "Hydraulic oil temperature high"},
                 {"code": "E0600-1", "severity": "medium", "text": "Hydraulic oil temperature warning"}],
         tasks=[task("Material Loading", "Sunny", "Sand", "Intermediate", 5, 36, 220, 55, "13:40")]),
    dict(id="DT-03", make="Cat", model="725", kind="Dumper", operator="Manoj Singh (OP1021)", zone="Haul road",
         x=52, y=78, hours=6120.4, tank_l=400, fuel_l=240, working_h=7.9, service_due_h=260, cycles=21, payload_t=483,
         idle_min={"waiting_for_truck": 0, "heat_rest": 40, "warm_up": 7, "cool_down": 4, "waste": 18},
         seatbelt_violations=0,
         health={**HEALTHY, "sos_water_pct": 0.42, "coolant_temp_max": 101, "machine_age_yrs": 8},
         hour_stats=dict(fuel_l=7.0, load_cycles=3, idle_min=14, seatbelt_off_min=0, harsh_swings=0, raised_bucket_travel=0),
         faults=[{"code": "E0361-2", "severity": "high", "text": "Coolant temperature high"}],
         tasks=[]),
    dict(id="DT-07", make="Cat", model="725", kind="Dumper", operator="Imran Khan (OP1024)", zone="Haul road",
         x=30, y=70, hours=3380.9, tank_l=400, fuel_l=196, working_h=7.6, service_due_h=90, cycles=19, payload_t=437,
         idle_min={"waiting_for_truck": 0, "heat_rest": 40, "warm_up": 6, "cool_down": 5, "waste": 9},
         seatbelt_violations=0,
         health={**HEALTHY, "machine_age_yrs": 4},
         hour_stats=dict(fuel_l=6.8, load_cycles=3, idle_min=10, seatbelt_off_min=0, harsh_swings=0, raised_bucket_travel=0),
         faults=[],
         tasks=[]),
    dict(id="BHL-11", make="JCB", model="3DX", kind="Backhoe loader (rental, mixed fleet)", operator="Deepak (OP1031)",
         zone="A", x=12, y=50, hours=8930.0, tank_l=120, fuel_l=41, working_h=4.2, service_due_h=-35, cycles=96, payload_t=0,
         idle_min={"waiting_for_truck": 20, "heat_rest": 40, "warm_up": 12, "cool_down": 3, "waste": 88},
         seatbelt_violations=4,
         health={**HEALTHY, "hrs_since_oil_change": 585, "sos_soot_pct": 2.1, "machine_age_yrs": 9},
         hour_stats=dict(fuel_l=3.6, load_cycles=1, idle_min=58, seatbelt_off_min=41, harsh_swings=2, raised_bucket_travel=1),
         faults=[{"code": "SVC", "severity": "medium", "text": "Oil change 85 h overdue"}],
         tasks=[task("Trenching", "Sunny", "Clay", "Beginner", 9, 36, 60, 30, "13:40")]),
]
(OUT / "fleet.json").write_text(json.dumps(fleet, indent=2))

print(f"tasks: {len(tasks)}  idle windows: {len(idle_rows)}  shift hours: {len(hour_rows)}  "
      f"machine days: {len(day_rows)}  fleet machines: {len(fleet)}")


# ---------------------------------------------------------------------------
# 6. OPERATOR HOURS  (per-operator history with context: the digital twin's input)
#    One row per operator-hour, tagged with the conditions it happened in, so the
#    twin can learn each person's usual *in those conditions*. Separate seed: the
#    datasets above stay byte-identical.
#    Planted, per person (the twin should find these on its own):
#      Ravi (OP1001):  idle rises ~70% in rain; on a rental with the other joystick
#                      pattern, harsh swings in the first 2 hours; unbuckles in long
#                      idles; idle creeps up after hour 7; strongest at loading.
#      Suresh (OP1007): expert, steady; idle 30+ min is abnormal *for him* even
#                      though it is ordinary for the site (fleet thresholds miss it).
#      Deepak (OP1031): high idle everywhere, belt off often (his "normal" is bad:
#                      the twin says so against the site, not against himself).
#    ~4% of hours carry a planted anomaly relative to that person's own pattern.
# ---------------------------------------------------------------------------
rng2 = np.random.default_rng(7)
OPERATORS = {
    # id: (name, machine kind, own machine, base idle, base cycles, fuel L/h, belt-off habit, tasks)
    "OP1001": ("Ravi Kumar", "Excavator", "EXC001", 16, 12, 5.4, 0.08,
               ["Trenching", "Material Loading", "Grading", "Earth Excavation"]),
    "OP1007": ("Suresh Pal", "Excavator", "EXC004", 11, 14, 5.6, 0.0,
               ["Earth Excavation", "Trenching", "Material Loading"]),
    "OP1012": ("Anil Yadav", "Wheel loader", "WHL002", 14, 15, 6.3, 0.03, ["Material Loading"]),
    "OP1021": ("Manoj Singh", "Dumper", "DT-03", 13, 3, 6.9, 0.0, ["Hauling"]),
    "OP1024": ("Imran Khan", "Dumper", "DT-07", 10, 3, 6.7, 0.0, ["Hauling"]),
    "OP1031": ("Deepak", "Backhoe loader", "BHL-11", 34, 6, 4.2, 0.35, ["Trenching", "Material Loading"]),
}
TASK_CYCLE = {"Trenching": 0.85, "Material Loading": 1.2, "Grading": 0.9, "Earth Excavation": 1.0, "Hauling": 1.0}
op_rows = []
for op, (name, kind, own, idle0, cyc0, fuel0, belt_habit, op_tasks) in OPERATORS.items():
    for day in range(60):
        weather = rng2.choice(WEATHER, p=[0.45, 0.25, 0.2, 0.1])
        task_type = rng2.choice(op_tasks)
        rental = op == "OP1001" and rng2.random() < 0.3  # Ravi sometimes runs a rental EXC (SAE)
        machine = "RENTAL-SAE" if rental else own
        for h in range(1, 11):
            idle = rng2.normal(idle0, idle0 * 0.25)
            cycles = rng2.normal(cyc0 * TASK_CYCLE.get(task_type, 1.0), cyc0 * 0.12)
            harsh = rng2.poisson(1)
            belt_off = 0.0
            if weather == "Rainy":
                idle *= 1.7 if op == "OP1001" else 1.15
            if op == "OP1001":
                if h >= 8:
                    idle *= 1.4; cycles *= 0.9
                if rental and h <= 2:
                    harsh += rng2.poisson(4)
            if idle > idle0 * 1.6 and rng2.random() < belt_habit * 6:
                belt_off = rng2.uniform(8, 25)
            elif rng2.random() < belt_habit:
                belt_off = rng2.uniform(2, 10)
            anomaly = rng2.random() < 0.04
            if anomaly:
                kind_a = rng2.choice(["idle", "belt", "harsh"])
                if kind_a == "idle":
                    idle = idle0 * rng2.uniform(2.2, 3.2); cycles *= 0.4
                elif kind_a == "belt":
                    belt_off = rng2.uniform(20, 45)
                else:
                    harsh += rng2.poisson(7)
            idle = float(np.clip(idle, 0, 60))
            cycles = max(cycles, 0)
            op_rows.append(dict(
                operator_id=op, operator=name, machine_kind=kind, machine_id=machine,
                day=day, hour_of_shift=h, weather=weather, task_type=task_type,
                idle_min=round(idle, 1), load_cycles=int(round(cycles)),
                fuel_l=round(max(fuel0 * (1 - idle / 60 * 0.6) + rng2.normal(0, 0.3), 0.5), 2),
                seatbelt_off_min=round(belt_off, 1), harsh_swings=int(harsh), planted_anomaly=int(anomaly)))
pd.DataFrame(op_rows).to_csv(OUT / "operator_hours.csv", index=False)
