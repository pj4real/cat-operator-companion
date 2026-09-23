"""
Trains the three models. Kept deliberately simple so every choice is explainable.

1. Task time range   : Gradient boosting with quantile loss -> P10 / P50 / P90
2. Idle reason       : Random forest classifier -> warm_up / cool_down / waiting / heat_rest / waste
3. Unusual behaviour : Isolation forest on hourly telemetry + readable rules

Run:  python train.py      (after generate_data.py)
Out:  models/*.joblib, models/metrics.json
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, IsolationForest, RandomForestClassifier
from sklearn.metrics import accuracy_score, mean_absolute_error
from sklearn.model_selection import train_test_split

HERE = Path(__file__).parent
DATA, MODELS = HERE / "data", HERE / "models"
MODELS.mkdir(exist_ok=True)
metrics = {}

# ---------------------------------------------------------------- 1. task time
tasks = pd.read_csv(DATA / "tasks.csv")
CAT_COLS = ["task_type", "weather", "operator_skill", "soil"]
NUM_COLS = ["machine_age_yrs", "ambient_temp_c", "volume_m3", "planner_estimate_min"]


def task_features(df, columns=None):
    X = pd.get_dummies(df[CAT_COLS + NUM_COLS], columns=CAT_COLS, dtype=float)
    if columns is not None:
        X = X.reindex(columns=columns, fill_value=0.0)
    return X


X = task_features(tasks)
y = tasks["actual_min"]
X_tr, X_te, y_tr, y_te, p_tr, p_te = train_test_split(
    X, y, tasks["planner_estimate_min"], test_size=0.2, random_state=0)

task_models = {}
for q in (0.1, 0.5, 0.9):
    m = GradientBoostingRegressor(loss="quantile", alpha=q, n_estimators=300,
                                  max_depth=3, learning_rate=0.05, random_state=0)
    m.fit(X_tr, y_tr)
    task_models[f"p{int(q*100)}"] = m

p10, p50, p90 = (task_models[k].predict(X_te) for k in ("p10", "p50", "p90"))
metrics["task_time"] = {
    "model_mae_min": round(mean_absolute_error(y_te, p50), 2),
    "planner_mae_min": round(mean_absolute_error(y_te, p_te), 2),
    "p10_p90_coverage": round(float(np.mean((y_te >= p10) & (y_te <= p90))), 3),
    "test_rows": int(len(y_te)),
}
joblib.dump({"models": task_models, "columns": list(X.columns)}, MODELS / "task_time.joblib")

# ---------------------------------------------------------------- 2. idle reason
idle = pd.read_csv(DATA / "idle_windows.csv")
IDLE_FEATURES = [c for c in idle.columns if c != "label"]
Xi_tr, Xi_te, yi_tr, yi_te = train_test_split(idle[IDLE_FEATURES], idle["label"],
                                              test_size=0.2, random_state=0, stratify=idle["label"])
idle_model = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=0)
idle_model.fit(Xi_tr, yi_tr)
metrics["idle_reason"] = {
    "accuracy": round(accuracy_score(yi_te, idle_model.predict(Xi_te)), 3),
    "top_features": sorted(zip(IDLE_FEATURES, idle_model.feature_importances_.round(3).tolist()),
                           key=lambda t: -t[1])[:4],
}
joblib.dump({"model": idle_model, "features": IDLE_FEATURES}, MODELS / "idle_reason.joblib")

# ---------------------------------------------------------------- 3. unusual behaviour
hours = pd.read_csv(DATA / "shift_hours.csv")
BEH_FEATURES = ["fuel_l", "load_cycles", "idle_min", "seatbelt_off_min", "harsh_swings", "raised_bucket_travel"]
iso = IsolationForest(n_estimators=200, contamination=0.06, random_state=0)
iso.fit(hours[BEH_FEATURES])
flagged = iso.predict(hours[BEH_FEATURES]) == -1
planted = hours["planted_anomaly"] == 1
metrics["unusual_behaviour"] = {
    "precision": round(float((flagged & planted).sum() / max(flagged.sum(), 1)), 3),
    "recall": round(float((flagged & planted).sum() / max(planted.sum(), 1)), 3),
}
joblib.dump({"model": iso, "features": BEH_FEATURES,
             "baseline": hours.loc[~planted, BEH_FEATURES].mean().round(2).to_dict()},
            MODELS / "behaviour.joblib")

(MODELS / "metrics.json").write_text(json.dumps(metrics, indent=2))
print(json.dumps(metrics, indent=2))
