"""
Synthetic data generator for the Cat Operator Companion.

We only got 4 telemetry rows and 5 task rows from the problem statement, so we
generate realistic history with the same columns (plus a few more). Every
pattern below is planted on purpose, so the models have something real to learn
and we can explain exactly why they predict what they predict.

Run:  python generate_data.py
Out:  data/tasks.csv, data/idle_windows.csv, data/shift_hours.csv
"""
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

print(f"tasks: {len(tasks)}  idle windows: {len(idle_rows)}  shift hours: {len(hour_rows)}")
