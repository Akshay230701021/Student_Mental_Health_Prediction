// src/api.js
// ─────────────────────────────────────────────────────────
// Centralised API service — all backend calls go here.
// Change BASE_URL to your deployed server if needed.
// ─────────────────────────────────────────────────────────

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

/**
 * POST /predict
 * Send one student's answers, get prediction + insights back.
 *
 * @param {Object} answers  — raw answers from the quiz form
 * @returns {Promise<Object>} prediction response from Flask
 */
export async function predictCounseling(answers) {
  const payload = buildPayload(answers);

  const res = await fetch(`${BASE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error: ${res.status}`);
  }

  return res.json();
}

/**
 * GET /model-info
 * Fetch metadata about the trained model (accuracy, best model name, etc.)
 */
export async function getModelInfo() {
  const res = await fetch(`${BASE_URL}/model-info`);
  if (!res.ok) throw new Error("Could not fetch model info");
  return res.json();
}

/**
 * POST /predict/batch
 * Send multiple student records at once.
 *
 * @param {Array<Object>} records — array of answer objects
 */
export async function predictBatch(records) {
  const payloads = records.map(buildPayload);
  const res = await fetch(`${BASE_URL}/predict/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloads),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────
// INTERNAL — map quiz answers → backend payload format
// ─────────────────────────────────────────────────────────
function buildPayload(answers) {
  return {
    age:                          Number(answers.age)                          || 20,
    gender:                       answers.gender                               || "Male",
    cgpa:                         Number(answers.cgpa)                         || 6.0,
    attendance_pct:               Number(answers.attendance_pct)               || 75,
    sleep_hours:                  Number(answers.sleep_hours)                  || 7.0,
    study_hours_per_day:          Number(answers.study_hours_per_day)          || 4.0,
    social_media_hours:           Number(answers.social_media_hours)           || 3.0,
    physical_activity:            answers.physical_activity                    || "Moderate",
    family_history_mental_illness: Number(answers.family_history_mental_illness) || 0,
    financial_stress:             Number(answers.financial_stress)             || 2,
    academic_pressure:            Number(answers.academic_pressure)            || 3,
    relationship_issues:          Number(answers.relationship_issues)          || 0,
    substance_use:                Number(answers.substance_use)                || 0,
    loneliness_score:             Number(answers.loneliness_score)             || 1,
    anxiety_score:                Number(answers.anxiety_score)                || 0,
    depression_score:             Number(answers.depression_score)             || 0,
  };
}
