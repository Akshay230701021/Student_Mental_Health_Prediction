"""
=============================================================
  Student Counseling Need Prediction - Flask Backend API
  Trains ML model on startup, exposes /predict endpoint
=============================================================
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import os
import warnings
warnings.filterwarnings('ignore')

from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, roc_auc_score, accuracy_score
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier

app = Flask(__name__)
CORS(app)  # Allow all origins (for React dev server)

# ─── Globals (populated at startup) ───────────────────────
model = None
le_gender = None
le_activity = None
model_meta = {}


# ─────────────────────────────────────────────────────────
# MODEL TRAINING  (runs once on server start)
# ─────────────────────────────────────────────────────────
def train_model():
    global model, le_gender, le_activity, model_meta

    CSV_PATH = os.path.join(os.path.dirname(__file__), "student_mental_health.csv")
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "counseling_model.pkl")
    META_PATH  = os.path.join(os.path.dirname(__file__), "model_meta.pkl")

    # ── Load dataset ──────────────────────────────────────
    df = pd.read_csv(CSV_PATH)
    print(f"[INFO] Dataset loaded: {df.shape[0]} rows × {df.shape[1]} cols")

    # ── Encode categoricals ───────────────────────────────
    le_gender   = LabelEncoder()
    le_activity = LabelEncoder()
    df["gender"]            = le_gender.fit_transform(df["gender"])
    df["physical_activity"] = le_activity.fit_transform(df["physical_activity"])

    X = df.drop("needs_counseling", axis=1)
    y = df["needs_counseling"]
    feature_names = X.columns.tolist()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # ── Define candidate models ───────────────────────────
    candidates = {
        "Gradient Boosting": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", GradientBoostingClassifier(n_estimators=100, random_state=42))
        ]),
        "Random Forest": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", RandomForestClassifier(n_estimators=100, random_state=42))
        ]),
        "Logistic Regression": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=1000, random_state=42))
        ]),
        "SVM": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", SVC(probability=True, random_state=42))
        ]),
        "KNN": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", KNeighborsClassifier(n_neighbors=7))
        ]),
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    results = {}
    print("\n[INFO] Training & evaluating models...")

    for name, m in candidates.items():
        cv_scores = cross_val_score(m, X_train, y_train, cv=cv, scoring="accuracy")
        m.fit(X_train, y_train)
        y_pred = m.predict(X_test)
        y_prob = m.predict_proba(X_test)[:, 1]
        roc    = roc_auc_score(y_test, y_prob)
        acc    = accuracy_score(y_test, y_pred)
        results[name] = {"model": m, "roc_auc": roc, "test_acc": acc,
                         "cv_mean": cv_scores.mean(), "cv_std": cv_scores.std()}
        print(f"  {name:25s} | CV={cv_scores.mean():.4f}±{cv_scores.std():.4f} "
              f"| Test Acc={acc:.4f} | ROC-AUC={roc:.4f}")

    # ── Pick best by ROC-AUC ──────────────────────────────
    best_name = max(results, key=lambda k: results[k]["roc_auc"])
    best      = results[best_name]
    model     = best["model"]

    # Feature importances (from RF always for interpretability)
    rf_m = results["Random Forest"]["model"].named_steps["clf"]
    importances = dict(zip(feature_names, rf_m.feature_importances_))
    top_features = sorted(importances, key=importances.get, reverse=True)[:5]

    model_meta = {
        "best_model":    best_name,
        "test_accuracy": round(best["test_acc"], 4),
        "roc_auc":       round(best["roc_auc"], 4),
        "cv_mean":       round(best["cv_mean"], 4),
        "cv_std":        round(best["cv_std"], 4),
        "feature_names": feature_names,
        "top_features":  top_features,
        "all_results": {
            k: {"test_acc": round(v["test_acc"], 4), "roc_auc": round(v["roc_auc"], 4)}
            for k, v in results.items()
        },
        "gender_classes":   le_gender.classes_.tolist(),
        "activity_classes": le_activity.classes_.tolist(),
    }

    # ── Persist ───────────────────────────────────────────
    joblib.dump(model, MODEL_PATH)
    joblib.dump({"le_gender": le_gender, "le_activity": le_activity,
                 "meta": model_meta}, META_PATH)

    print(f"\n[INFO] ✅ Best model: {best_name} | ROC-AUC: {best['roc_auc']:.4f}")
    print(f"[INFO] Model saved → {MODEL_PATH}")


# ─────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────
REQUIRED_FIELDS = [
    "age", "gender", "cgpa", "attendance_pct", "sleep_hours",
    "study_hours_per_day", "social_media_hours", "physical_activity",
    "family_history_mental_illness", "financial_stress",
    "academic_pressure", "relationship_issues", "substance_use",
    "loneliness_score", "anxiety_score", "depression_score"
]

def build_input_df(data: dict) -> pd.DataFrame:
    df = pd.DataFrame([data])
    df["gender"]            = le_gender.transform(df["gender"])
    df["physical_activity"] = le_activity.transform(df["physical_activity"])
    # ensure column order matches training
    df = df[model_meta["feature_names"]]
    return df


def risk_level(prob: float) -> str:
    if prob < 0.35:
        return "low"
    elif prob < 0.65:
        return "moderate"
    return "high"


def risk_label(level: str) -> str:
    return {
        "low":      "No Counseling Needed",
        "moderate": "Monitor — Consider Support",
        "high":     "Counseling Recommended",
    }[level]


def build_insights(data: dict, prob: float) -> list[dict]:
    insights = []
    anxiety = float(data.get("anxiety_score", 0))
    depression = float(data.get("depression_score", 0))
    sleep = float(data.get("sleep_hours", 7))
    loneliness = float(data.get("loneliness_score", 1))
    pressure = float(data.get("academic_pressure", 3))
    cgpa = float(data.get("cgpa", 6))

    if anxiety >= 7:
        insights.append({
            "type": "warning",
            "title": "Elevated Anxiety",
            "text": "Your anxiety level is in the higher range. Breathing exercises, "
                    "mindfulness, or talking to a campus counselor can help significantly."
        })
    if depression >= 7:
        insights.append({
            "type": "warning",
            "title": "Low Mood Indicators",
            "text": "You may be experiencing persistent low mood. Reaching out to a "
                    "mental health professional or a trusted person is a good next step."
        })
    if sleep <= 5:
        insights.append({
            "type": "warning",
            "title": "Sleep Deprivation",
            "text": f"Getting only {sleep:.1f} hrs/night amplifies anxiety and depression. "
                    "Prioritising 7–9 hours is one of the highest-impact changes you can make."
        })
    if loneliness >= 5:
        insights.append({
            "type": "warning",
            "title": "Social Disconnection",
            "text": "Loneliness is a strong predictor of poor mental health. Even small "
                    "social interactions — study groups or clubs — make a real difference."
        })
    if pressure >= 4 and cgpa < 5.5:
        insights.append({
            "type": "warning",
            "title": "Academic Stress + Low Performance",
            "text": "High pressure alongside a lower CGPA can create a difficult cycle. "
                    "Speaking to an academic advisor may relieve some of this burden."
        })
    if not insights:
        insights.append({
            "type": "success",
            "title": "Profile Looks Stable",
            "text": "Based on your responses, you appear to be managing well. Keep investing "
                    "in sleep, physical activity, and social connection."
        })
    return insights


# ─────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "ok", "message": "Counseling Prediction API is running"})


@app.route("/model-info", methods=["GET"])
def model_info():
    """Return model metadata (accuracy, features, etc.)"""
    return jsonify(model_meta)


@app.route("/predict", methods=["POST"])
def predict():
    """
    Accepts JSON with all 16 student features.
    Returns prediction, probability, risk level, and insights.
    """
    if model is None:
        return jsonify({"error": "Model not initialised"}), 500

    data = request.get_json(force=True)

    # ── Validate ──────────────────────────────────────────
    missing = [f for f in REQUIRED_FIELDS if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    # ── Type-cast numerics ────────────────────────────────
    num_fields = [
        "age", "cgpa", "attendance_pct", "sleep_hours",
        "study_hours_per_day", "social_media_hours",
        "family_history_mental_illness", "financial_stress",
        "academic_pressure", "relationship_issues", "substance_use",
        "loneliness_score", "anxiety_score", "depression_score"
    ]
    for f in num_fields:
        try:
            data[f] = float(data[f])
        except (ValueError, TypeError):
            return jsonify({"error": f"Invalid value for '{f}'"}), 400

    # ── Validate categoricals ─────────────────────────────
    if data["gender"] not in model_meta["gender_classes"]:
        return jsonify({"error": f"gender must be one of {model_meta['gender_classes']}"}), 400
    if data["physical_activity"] not in model_meta["activity_classes"]:
        return jsonify({"error": f"physical_activity must be one of {model_meta['activity_classes']}"}), 400

    try:
        df_input = build_input_df(data)
        prob        = float(model.predict_proba(df_input)[0][1])
        prediction  = int(model.predict(df_input)[0])
        level       = risk_level(prob)
        label       = risk_label(level)
        insights    = build_insights(data, prob)

        return jsonify({
            "prediction":   prediction,          # 0 or 1
            "probability":  round(prob, 4),      # 0.0 – 1.0
            "risk_level":   level,               # "low" | "moderate" | "high"
            "risk_label":   label,
            "risk_score":   round(prob * 100, 1),  # 0–100 for UI gauge
            "insights":     insights,
            "top_features": model_meta["top_features"],
            "model_used":   model_meta["best_model"],
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    """Accept a list of student records and return predictions for all."""
    if model is None:
        return jsonify({"error": "Model not initialised"}), 500

    records = request.get_json(force=True)
    if not isinstance(records, list):
        return jsonify({"error": "Expected a JSON array of student records"}), 400

    results = []
    for i, data in enumerate(records):
        missing = [f for f in REQUIRED_FIELDS if f not in data]
        if missing:
            results.append({"index": i, "error": f"Missing fields: {missing}"})
            continue
        try:
            df_input   = build_input_df(data)
            prob       = float(model.predict_proba(df_input)[0][1])
            prediction = int(model.predict(df_input)[0])
            results.append({
                "index":      i,
                "prediction": prediction,
                "probability": round(prob, 4),
                "risk_level": risk_level(prob),
                "risk_label": risk_label(risk_level(prob)),
                "risk_score": round(prob * 100, 1),
            })
        except Exception as e:
            results.append({"index": i, "error": str(e)})

    return jsonify(results)


# ─────────────────────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  STUDENT COUNSELING PREDICTION — FLASK API")
    print("=" * 60)
    train_model()
    print("\n[INFO] Starting server on http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)