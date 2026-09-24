"""
Trains the five models. Kept deliberately simple so every choice is explainable.

1. Task time range   : Gradient boosting with quantile loss -> P10 / P50 / P90
2. Idle reason       : Random forest classifier -> warm_up / cool_down / waiting / heat_rest / waste
3. Unusual behaviour : Isolation forest on hourly telemetry + readable rules
4. Machine health    : Gradient boosting classifier -> risk of a failure in the next 50 engine hours
5. Fuel burn rate    : Gradient boosting regressor -> L/h for a task, used for the run-out forecast

Run:  python train.py      (after generate_data.py)
Out:  models/*.joblib, models/metrics.json
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import (GradientBoostingClassifier, GradientBoostingRegressor, IsolationForest,
                              RandomForestClassifier)
from sklearn.metrics import accuracy_score, mean_absolute_error, roc_auc_score
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

# P50 learns from the whole training split. P10/P90 learn from 75% of it; the other 25% is a
# calibration split for split-conformal correction (conformalized quantile regression, Romano et
# al. 2019): raw quantile models under-cover, so we measure by how much on data they never saw
# and widen both ends by that margin q. The test split stays untouched for the final numbers.
X_fit, X_cal, y_fit, y_cal = train_test_split(X_tr, y_tr, test_size=0.25, random_state=1)
task_models = {}
for q in (0.1, 0.5, 0.9):
    m = GradientBoostingRegressor(loss="quantile", alpha=q, n_estimators=300,
                                  max_depth=3, learning_rate=0.05, random_state=0)
    m.fit(*((X_tr, y_tr) if q == 0.5 else (X_fit, y_fit)))
    task_models[f"p{int(q*100)}"] = m

ALPHA = 0.2  # nominal P10-P90 = 80% coverage
lo_cal, hi_cal = task_models["p10"].predict(X_cal), task_models["p90"].predict(X_cal)
scores = np.maximum(lo_cal - y_cal.to_numpy(), y_cal.to_numpy() - hi_cal)
n_cal = len(scores)
conformal_q = float(np.quantile(scores, min(np.ceil((n_cal + 1) * (1 - ALPHA)) / n_cal, 1.0), method="higher"))

p10, p50, p90 = (task_models[k].predict(X_te) for k in ("p10", "p50", "p90"))
metrics["task_time"] = {
    "model_mae_min": round(mean_absolute_error(y_te, p50), 2),
    "planner_mae_min": round(mean_absolute_error(y_te, p_te), 2),
    "p10_p90_coverage_raw": round(float(np.mean((y_te >= p10) & (y_te <= p90))), 3),
    "p10_p90_coverage": round(float(np.mean((y_te >= p10 - conformal_q) & (y_te <= p90 + conformal_q))), 3),
    "conformal_q_min": round(conformal_q, 2),
    "mean_band_width_min": round(float(np.mean(p90 - p10 + 2 * conformal_q)), 1),
    "calibration_rows": int(n_cal),
    "test_rows": int(len(y_te)),
}
joblib.dump({"models": task_models, "columns": list(X.columns), "conformal_q": conformal_q},
            MODELS / "task_time.joblib")

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
# Unsupervised, so labels are never used for fitting -- but precision/recall are still measured
# on days the forest never saw: fit on days 0-69, score the last 20 days (70-89).
hours_tr, hours_te = hours[hours["day"] < 70], hours[hours["day"] >= 70]
iso = IsolationForest(n_estimators=200, contamination=0.06, random_state=0)
iso.fit(hours_tr[BEH_FEATURES])
flagged = iso.predict(hours_te[BEH_FEATURES]) == -1
planted = (hours_te["planted_anomaly"] == 1).to_numpy()
metrics["unusual_behaviour"] = {
    "precision": round(float((flagged & planted).sum() / max(flagged.sum(), 1)), 3),
    "recall": round(float((flagged & planted).sum() / max(planted.sum(), 1)), 3),
    "flags": int(flagged.sum()), "planted": int(planted.sum()),
    "train_hours": int(len(hours_tr)), "test_hours": int(len(hours_te)),
}
joblib.dump({"model": iso, "features": BEH_FEATURES,
             "baseline": hours_tr.loc[hours_tr["planted_anomaly"] == 0, BEH_FEATURES].mean().round(2).to_dict()},
            MODELS / "behaviour.joblib")

# ---------------------------------------------------------------- 4. machine health risk
days = pd.read_csv(DATA / "machine_days.csv")
HEALTH_FEATURES = [c for c in days.columns if c != "fails_within_50h"]
Xh_tr, Xh_te, yh_tr, yh_te = train_test_split(days[HEALTH_FEATURES], days["fails_within_50h"],
                                              test_size=0.2, random_state=0, stratify=days["fails_within_50h"])
health_model = GradientBoostingClassifier(n_estimators=200, max_depth=3, learning_rate=0.05, random_state=0)
health_model.fit(Xh_tr, yh_tr)
risk = health_model.predict_proba(Xh_te)[:, 1]
top = risk >= np.quantile(risk, 0.9)
metrics["machine_health"] = {
    "roc_auc": round(float(roc_auc_score(yh_te, risk)), 3),
    "precision_top10pct": round(float(yh_te[top].mean()), 3),
    "base_failure_rate": round(float(yh_te.mean()), 3),
}
joblib.dump({"model": health_model, "features": HEALTH_FEATURES}, MODELS / "machine_health.joblib")

# ---------------------------------------------------------------- 5. fuel burn rate
yf = tasks["fuel_lph"]
Xf_tr, Xf_te, yf_tr, yf_te = train_test_split(X, yf, test_size=0.2, random_state=0)
fuel_model = GradientBoostingRegressor(n_estimators=300, max_depth=3, learning_rate=0.05, random_state=0)
fuel_model.fit(Xf_tr, yf_tr)
flat_rate = float(yf_tr.mean())  # what a single "L/h for a Cat 320" rule of thumb would say
metrics["fuel_rate"] = {
    "model_mae_lph": round(mean_absolute_error(yf_te, fuel_model.predict(Xf_te)), 2),
    "flat_rate_mae_lph": round(mean_absolute_error(yf_te, np.full(len(yf_te), flat_rate)), 2),
    "flat_rate_lph": round(flat_rate, 2),
}
joblib.dump({"model": fuel_model, "columns": list(X.columns)}, MODELS / "fuel_rate.joblib")

# ---------------------------------------------------------------- 6. operator digital twin
# Not a trained model: per-operator, per-condition running statistics (twin.py). Evaluated
# the honest way: learn from days 0-44 (all hours, no labels), score days 45-59, and compare
# with the same z-score test against the site-wide baseline ("one threshold for everyone").
from twin import METRICS as TWIN_METRICS, BAD_DIR, MIN_STD, Stat, TwinNetwork  # noqa: E402

ops = pd.read_csv(DATA / "operator_hours.csv")
ops_train, ops_test = ops[ops["day"] < 45], ops[ops["day"] >= 45]
net = TwinNetwork(ops_train)
site = {m: Stat() for m in TWIN_METRICS}
for m in TWIN_METRICS:
    for v in ops_train[m]:
        site[m].add(float(v))


def site_flag(r):
    zs = [(r[m] - site[m].mean) / max(site[m].std, MIN_STD[m]) * BAD_DIR[m] for m in TWIN_METRICS if BAD_DIR[m]]
    return max(zs) >= 2.5 or sum(z >= 2.0 for z in zs) >= 2


twin_flags, site_flags = [], []
for r in ops_test.to_dict("records"):
    twin_flags.append(net.score(r["operator_id"], r, r)["unusual"])
    site_flags.append(site_flag(r))
truth = ops_test["planted_anomaly"].to_numpy() == 1


def pr(flags):
    f = np.array(flags)
    return {"precision": round(float((f & truth).sum() / max(f.sum(), 1)), 3),
            "recall": round(float((f & truth).sum() / max(truth.sum(), 1)), 3), "flags": int(f.sum())}


metrics["operator_twin"] = {"twin": pr(twin_flags), "site_threshold": pr(site_flags),
                            "test_hours": int(len(ops_test)), "planted": int(truth.sum())}

(MODELS / "metrics.json").write_text(json.dumps(metrics, indent=2))
print(json.dumps(metrics, indent=2))
