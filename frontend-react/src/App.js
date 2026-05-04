// src/App.jsx
import { useState } from "react";
import { predictCounseling, getModelInfo } from "./api";

// ─────────────────────────────────────────────────────────
// QUIZ DATA  (unchanged from your original)
// ─────────────────────────────────────────────────────────
const SECTIONS = [
  {
    label: "Personal & Academic",
    questions: [
      { id: "age", text: "What is your age?", type: "options",
        options: ["17","18","19","20","21","22","23","24+"],
        values:  [17, 18, 19, 20, 21, 22, 23, 24] },
      { id: "gender", text: "What is your gender?", type: "options",
        options: ["Male","Female","Other"], values: ["Male","Female","Other"] },
      { id: "cgpa", text: "Current CGPA / GPA (out of 10)",
        type: "slider", min: 1, max: 10, step: 0.1, default: 6.5,
        labelLo: "1.0 — Very low", labelHi: "10.0 — Perfect" },
      { id: "attendance_pct", text: "Percentage of classes attended",
        type: "slider", min: 30, max: 100, step: 1, default: 75,
        labelLo: "30%", labelHi: "100%" },
      { id: "study_hours_per_day", text: "Study hours per day",
        type: "slider", min: 0, max: 12, step: 0.5, default: 4,
        labelLo: "0 hrs", labelHi: "12 hrs" },
      { id: "academic_pressure", text: "Academic pressure level", type: "options",
        options: ["Very low","Low","Moderate","High","Very high"],
        values:  [1, 2, 3, 4, 5] },
    ],
  },
  {
    label: "Lifestyle & Habits",
    questions: [
      { id: "sleep_hours", text: "Hours of sleep per night",
        type: "slider", min: 2, max: 12, step: 0.5, default: 7,
        labelLo: "2 hrs", labelHi: "12 hrs" },
      { id: "social_media_hours", text: "Hours on social media per day",
        type: "slider", min: 0, max: 12, step: 0.5, default: 3,
        labelLo: "0 hrs", labelHi: "12 hrs" },
      { id: "physical_activity", text: "Physical activity level", type: "options",
        options: ["No activity","Low","Moderate","High"],
        values:  ["No Activity","Low","Moderate","High"] },
      { id: "substance_use", text: "Do you use substances (alcohol, recreational drugs)?",
        type: "options", options: ["No","Yes"], values: [0, 1] },
      { id: "financial_stress", text: "Financial stress level", type: "options",
        options: ["None","Mild","Moderate","High","Severe"],
        values:  [1, 2, 3, 4, 5] },
    ],
  },
  {
    label: "Social & Family",
    questions: [
      { id: "family_history_mental_illness", text: "Family history of mental illness?",
        type: "options", options: ["No","Yes"], values: [0, 1] },
      { id: "relationship_issues", text: "Currently experiencing relationship difficulties?",
        type: "options", options: ["No","Yes"], values: [0, 1] },
    ],
  },
  {
    label: "How You've Been Feeling",
    questions: [
      { id: "loneliness_score",
        text: "Over the past week, how often have you felt lonely or disconnected?",
        type: "options",
        options: ["Never","Rarely","Sometimes","Often","Frequently","Most days","Constantly"],
        values:  [1, 2, 3, 4, 5, 6, 7] },
      { id: "anxiety_score",
        text: "How often do you feel anxious, nervous, or on edge?",
        type: "options",
        options: ["Never (0)","Barely (1–2)","Mild (3–4)","Moderate (5–6)","High (7–8)","Severe (9)","Extreme (10)"],
        values:  [0, 2, 3, 5, 7, 9, 10] },
      { id: "depression_score",
        text: "How often do you feel hopeless or lose interest in things you enjoyed?",
        type: "options",
        options: ["Never (0)","Rarely (1–2)","Sometimes (3–4)","Moderate (5–6)","Often (7–8)","Mostly (9)","Constantly (10)"],
        values:  [0, 2, 3, 5, 7, 9, 10] },
    ],
  },
];

const ALL_QUESTIONS = SECTIONS.flatMap(s => s.questions);

// Pre-fill slider defaults
const DEFAULTS = {};
ALL_QUESTIONS.forEach(q => { if (q.type === "slider") DEFAULTS[q.id] = q.default; });

// ─────────────────────────────────────────────────────────
// TINY SUB-COMPONENTS
// ─────────────────────────────────────────────────────────
function ScoreBar({ value, max, color }) {
  return (
    <div style={{ height: 5, background: "#e5e7eb", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${Math.min(100, (value / max) * 100)}%`,
        background: color, borderRadius: 99, transition: "width 0.8s ease",
      }} />
    </div>
  );
}

function getRiskColor(val, max) {
  const r = val / max;
  if (r < 0.35) return "#16a34a";
  if (r < 0.65) return "#d97706";
  return "#dc2626";
}

function InsightCard({ insight }) {
  const colors = {
    warning: { bg: "#fff7ed", border: "#fed7aa", title: "#9a3412" },
    success: { bg: "#f0fdf4", border: "#bbf7d0", title: "#166534" },
  };
  const c = colors[insight.type] || colors.success;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 12, padding: "1.25rem", marginBottom: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: c.title, marginBottom: 6 }}>
        {insight.title}
      </div>
      <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.7, margin: 0 }}>
        {insight.text}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RESULTS PAGE
// ─────────────────────────────────────────────────────────
function ResultsPage({ result, answers, onRetake }) {
  const riskColor = getRiskColor(result.risk_score, 100);
  const riskBg = result.risk_level === "low"
    ? { bg: "#dcfce7", color: "#166534" }
    : result.risk_level === "moderate"
    ? { bg: "#fef3c7", color: "#92400e" }
    : { bg: "#fee2e2", color: "#991b1b" };

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 640, margin: "0 auto", paddingBottom: "2rem" }}>
      {/* Header */}
      <div style={{ textAlign: "center", padding: "2rem 1.5rem 1.5rem", borderBottom: "1px solid #e5e7eb", marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 400, fontStyle: "italic", color: "#111", marginBottom: 6 }}>
          Your Wellbeing Report
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280" }}>
          Analysed by <strong>{result.model_used}</strong> · {ALL_QUESTIONS.length} questions · 4 domains
        </p>
        <div style={{
          display: "inline-block", marginTop: 10, padding: "5px 18px",
          borderRadius: 99, fontSize: 13, fontWeight: 500,
          background: riskBg.bg, color: riskBg.color,
        }}>
          {result.risk_label}
        </div>
      </div>

      <div style={{ padding: "0 1rem" }}>
        {/* Mental health scores */}
        <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10, fontWeight: 500 }}>
          Core mental health scores
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: "1.5rem" }}>
          {[
            { label: "Loneliness", val: answers.loneliness_score, max: 7 },
            { label: "Anxiety",    val: answers.anxiety_score,    max: 10 },
            { label: "Depression", val: answers.depression_score, max: 10 },
          ].map(({ label, val }) => {
            const num = Number(val) || 0;
            const maxV = label === "Loneliness" ? 7 : 10;
            const c = getRiskColor(num, maxV);
            return (
              <div key={label} style={{ background: "#f9fafb", borderRadius: 10, padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 500, color: c, lineHeight: 1 }}>{num}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>out of {maxV}</div>
                <ScoreBar value={num} max={maxV} color={c} />
              </div>
            );
          })}
        </div>

        {/* Risk gauge */}
        <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10, fontWeight: 500 }}>
          ML model risk score
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Counseling risk score</span>
            <span style={{ fontSize: 28, fontWeight: 500 }}>
              {result.risk_score.toFixed(1)}
              <span style={{ fontSize: 13, color: "#9ca3af" }}>/100</span>
            </span>
          </div>
          <div style={{ height: 8, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${result.risk_score}%`,
              background: riskColor, borderRadius: 99, transition: "width 0.8s",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#9ca3af" }}>
            <span>Low risk</span><span>Moderate</span><span>High risk</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            <strong>Model probability:</strong> {(result.probability * 100).toFixed(1)}% chance of needing counseling
          </div>
        </div>

        {/* Key factors */}
        <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10, fontWeight: 500 }}>
          Key factors
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0 1.25rem", marginBottom: "1.5rem" }}>
          {[
            ["Sleep per night",       `${Number(answers.sleep_hours || 7).toFixed(1)} hrs`],
            ["CGPA",                  Number(answers.cgpa || 6).toFixed(1)],
            ["Attendance",            `${Math.round(answers.attendance_pct || 75)}%`],
            ["Study hours/day",       `${Number(answers.study_hours_per_day || 0).toFixed(1)} hrs`],
            ["Social media/day",      `${Number(answers.social_media_hours || 0).toFixed(1)} hrs`],
            ["Physical activity",     answers.physical_activity || "—"],
            ["Substance use",         Number(answers.substance_use) ? "Yes" : "No"],
            ["Family history",        Number(answers.family_history_mental_illness) ? "Yes" : "No"],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
              <span style={{ color: "#6b7280" }}>{label}</span>
              <span style={{ fontWeight: 500 }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Top features */}
        {result.top_features && (
          <>
            <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10, fontWeight: 500 }}>
              Most predictive features (Random Forest)
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.75rem 1.25rem", marginBottom: "1.5rem" }}>
              {result.top_features.map((f, i) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af", minWidth: 16 }}>#{i+1}</span>
                  <span style={{ color: "#374151", fontFamily: "monospace", fontSize: 12, background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>{f}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Insights */}
        <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10, fontWeight: 500 }}>
          Insights & recommendations
        </div>
        {result.insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}

        {/* CTA */}
        <div style={{ background: "#f9fafb", borderRadius: 12, padding: "1.25rem", textAlign: "center", marginTop: "1rem" }}>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 1.6 }}>
            This is a screening tool based on a real ML model — not a clinical diagnosis.
            If you're struggling, please reach out to your campus counseling center.
          </p>
          <button onClick={onRetake} style={{ background: "transparent", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Retake assessment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────
export default function App() {
  const [sectionIdx, setSectionIdx] = useState(0);
  const [answers, setAnswers]       = useState({ ...DEFAULTS });
  const [page, setPage]             = useState("quiz"); // "quiz" | "loading" | "results" | "error"
  const [result, setResult]         = useState(null);
  const [errorMsg, setErrorMsg]     = useState("");

  const section  = SECTIONS[sectionIdx];
  const isLast   = sectionIdx === SECTIONS.length - 1;
  const progress = Math.round((sectionIdx / SECTIONS.length) * 100);
  const complete  = section.questions.every(q => answers[q.id] !== undefined);

  function setAnswer(id, val) {
    setAnswers(prev => ({ ...prev, [id]: val }));
  }

  async function handleFinish() {
    setPage("loading");
    try {
      const res = await predictCounseling(answers);
      setResult(res);
      setPage("results");
    } catch (err) {
      setErrorMsg(err.message || "Could not reach prediction server.");
      setPage("error");
    }
  }

  function handleRetake() {
    setSectionIdx(0);
    setAnswers({ ...DEFAULTS });
    setResult(null);
    setErrorMsg("");
    setPage("quiz");
  }

  // ── Loading screen ──────────────────────────────────────
  if (page === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#111", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ marginTop: 16, color: "#6b7280", fontSize: 14 }}>Running ML model prediction…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Error screen ────────────────────────────────────────
  if (page === "error") {
    return (
      <div style={{ maxWidth: 500, margin: "4rem auto", textAlign: "center", fontFamily: "'DM Sans', system-ui, sans-serif", padding: "0 1.5rem" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400, marginBottom: 8 }}>Prediction failed</h2>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>{errorMsg}</p>
        <p style={{ color: "#9ca3af", fontSize: 12, marginBottom: 20 }}>
          Make sure the Flask backend is running on <code>http://localhost:5000</code>
        </p>
        <button onClick={handleRetake} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer", background: "transparent", fontFamily: "inherit" }}>
          Try again
        </button>
      </div>
    );
  }

  // ── Results ─────────────────────────────────────────────
  if (page === "results" && result) {
    return <ResultsPage result={result} answers={answers} onRetake={handleRetake} />;
  }

  // ── Quiz ────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 640, margin: "0 auto", paddingBottom: "2rem" }}>
      {/* Header */}
      <div style={{ textAlign: "center", padding: "2rem 1.5rem 1rem", borderBottom: "1px solid #e5e7eb", marginBottom: "1rem" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400, fontStyle: "italic", color: "#111", marginBottom: 4 }}>
          Student Wellbeing Assessment
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280" }}>
          Powered by a trained ML model on real student mental health data
        </p>
      </div>

      {/* Progress */}
      <div style={{ height: 3, background: "#f3f4f6", margin: "0 1.5rem 1.25rem", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "#374151", borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>

      {/* Section label */}
      <div style={{ fontSize: 11, letterSpacing: "1.5px", textTransform: "uppercase", color: "#9ca3af", padding: "0 1.5rem", marginBottom: "1rem", fontWeight: 500 }}>
        {section.label}
      </div>

      {/* Questions */}
      {section.questions.map(q => {
        const answered = answers[q.id] !== undefined;
        return (
          <div key={q.id} style={{
            margin: "0 1rem 12px",
            background: "#fff",
            border: `1px solid ${answered ? "#d1d5db" : "#e5e7eb"}`,
            borderRadius: 12, padding: "1.25rem",
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#111", marginBottom: 12, lineHeight: 1.5 }}>
              {q.text}
            </div>

            {q.type === "options" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {q.options.map((opt, i) => {
                  const sel = answers[q.id] === q.values[i];
                  return (
                    <button key={i} onClick={() => setAnswer(q.id, q.values[i])} style={{
                      background: sel ? "#111" : "#f9fafb",
                      border: `1px solid ${sel ? "#111" : "#e5e7eb"}`,
                      borderRadius: 8, padding: "6px 14px", fontSize: 12,
                      fontFamily: "inherit", color: sel ? "#fff" : "#6b7280",
                      cursor: "pointer", fontWeight: sel ? 500 : 400,
                    }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "slider" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input type="range" min={q.min} max={q.max} step={q.step}
                    value={answers[q.id] !== undefined ? answers[q.id] : q.default}
                    onChange={e => setAnswer(q.id, parseFloat(e.target.value))}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 14, fontWeight: 500, minWidth: 36, textAlign: "right" }}>
                    {Number(answers[q.id] !== undefined ? answers[q.id] : q.default).toFixed(q.step < 1 ? 1 : 0)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  <span>{q.labelLo}</span><span>{q.labelHi}</span>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.5rem 0.5rem" }}>
        <button onClick={() => setSectionIdx(i => i - 1)} disabled={sectionIdx === 0} style={{
          padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db",
          background: "transparent", fontSize: 13, fontFamily: "inherit",
          cursor: sectionIdx === 0 ? "not-allowed" : "pointer",
          opacity: sectionIdx === 0 ? 0.35 : 1,
        }}>
          ← Back
        </button>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{sectionIdx + 1} of {SECTIONS.length}</span>
        <button
          onClick={() => isLast ? handleFinish() : setSectionIdx(i => i + 1)}
          disabled={!complete}
          style={{
            padding: "8px 20px", borderRadius: 8, fontSize: 13,
            fontFamily: "inherit", fontWeight: 500,
            cursor: complete ? "pointer" : "not-allowed",
            background: complete ? "#111" : "#f3f4f6",
            color: complete ? "#fff" : "#9ca3af",
            border: `1px solid ${complete ? "#111" : "#e5e7eb"}`,
          }}
        >
          {isLast ? "Get my prediction →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
