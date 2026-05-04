import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
import joblib
warnings.filterwarnings('ignore')

from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (classification_report, confusion_matrix,
                             roc_auc_score, roc_curve, accuracy_score)
from sklearn.ensemble import GradientBoostingClassifier


BASE_PATH = r'C:\Users\aksha\OneDrive\Desktop\FOML\backend-flask'


print("=" * 60)
print("  STUDENT COUNSELING NEED PREDICTION")
print("  Model: Gradient Boosting Classifier")
print("=" * 60)

df = pd.read_csv(rf'{BASE_PATH}\student_mental_health.csv')
print(f"\n✅ Dataset loaded: {df.shape[0]} students, {df.shape[1]} features")
print(f"\nClass distribution:")
print(df['needs_counseling'].value_counts().rename({0: 'No Counseling', 1: 'Needs Counseling'}))


fig, axes = plt.subplots(2, 3, figsize=(16, 10))
fig.suptitle('Student Mental Health - Exploratory Data Analysis', fontsize=16, fontweight='bold')

colors = ['#2ecc71', '#e74c3c']
labels = ['No Counseling', 'Needs Counseling']

# Plot 1: Class distribution
ax = axes[0, 0]
counts = df['needs_counseling'].value_counts()
ax.bar(labels, counts.values, color=colors, edgecolor='white', linewidth=1.5)
ax.set_title('Counseling Need Distribution', fontweight='bold')
ax.set_ylabel('Number of Students')
for i, v in enumerate(counts.values):
    ax.text(i, v + 5, str(v), ha='center', fontweight='bold')

# Plot 2: CGPA distribution
ax = axes[0, 1]
for val, color, label in zip([0, 1], colors, labels):
    ax.hist(df[df['needs_counseling'] == val]['cgpa'], bins=20,
            alpha=0.7, color=color, label=label)
ax.set_title('CGPA by Counseling Need', fontweight='bold')
ax.set_xlabel('CGPA')
ax.legend()

# Plot 3: Anxiety score
ax = axes[0, 2]
df.boxplot(column='anxiety_score', by='needs_counseling', ax=ax,
           boxprops=dict(color='navy'), medianprops=dict(color='red', linewidth=2))
ax.set_title('Anxiety Score by Counseling Need', fontweight='bold')
ax.set_xlabel('')
ax.set_xticklabels(labels)
plt.sca(ax)
plt.title('Anxiety Score by Counseling Need')

# Plot 4: Sleep hours
ax = axes[1, 0]
df.boxplot(column='sleep_hours', by='needs_counseling', ax=ax,
           boxprops=dict(color='navy'), medianprops=dict(color='red', linewidth=2))
ax.set_title('Sleep Hours by Counseling Need', fontweight='bold')
ax.set_xlabel('')
ax.set_xticklabels(labels)
plt.sca(ax)
plt.title('Sleep Hours by Counseling Need')

# Plot 5: Academic pressure
ax = axes[1, 1]
pressure_counts = df.groupby(['academic_pressure', 'needs_counseling']).size().unstack(fill_value=0)
pressure_counts.plot(kind='bar', ax=ax, color=colors, edgecolor='white')
ax.set_title('Academic Pressure vs Counseling Need', fontweight='bold')
ax.set_xlabel('Academic Pressure (1=Low, 5=High)')
ax.legend(labels)
ax.tick_params(axis='x', rotation=0)

# Plot 6: Gender breakdown
ax = axes[1, 2]
gender_counts = df.groupby(['gender', 'needs_counseling']).size().unstack(fill_value=0)
gender_counts.plot(kind='bar', ax=ax, color=colors, edgecolor='white')
ax.set_title('Gender vs Counseling Need', fontweight='bold')
ax.legend(labels)
ax.tick_params(axis='x', rotation=0)

plt.tight_layout()
plt.savefig(rf'{BASE_PATH}\eda_plots.png', dpi=150, bbox_inches='tight')
plt.close()
print("\n✅ EDA plots saved")


df_model = df.copy()

# Encode categorical columns
le_gender = LabelEncoder()
le_activity = LabelEncoder()
df_model['gender'] = le_gender.fit_transform(df_model['gender'])
df_model['physical_activity'] = le_activity.fit_transform(df_model['physical_activity'])

X = df_model.drop('needs_counseling', axis=1)
y = df_model['needs_counseling']

feature_names = X.columns.tolist()

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"\n✅ Train: {X_train.shape[0]} | Test: {X_test.shape[0]}")


print("\n" + "=" * 60)
print("  GRADIENT BOOSTING — 5-Fold Cross Validation")
print("=" * 60)

model = Pipeline([
    ('scaler', StandardScaler()),
    ('clf', GradientBoostingClassifier(n_estimators=100, random_state=42))
])

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring='accuracy')

model.fit(X_train, y_train)
y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]

test_acc = accuracy_score(y_test, y_pred)
roc = roc_auc_score(y_test, y_prob)

print(f"\nGradient Boosting:")
print(f"  CV Accuracy : {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
print(f"  Test Accuracy: {test_acc:.4f}")
print(f"  ROC-AUC     : {roc:.4f}")

print(f"\n{'=' * 60}")
print(f"  CLASSIFICATION REPORT")
print(f"{'=' * 60}")
print(classification_report(y_test, y_pred,
                             target_names=['No Counseling', 'Needs Counseling']))


fig, axes = plt.subplots(1, 3, figsize=(18, 6))
fig.suptitle('Gradient Boosting — Model Results', fontsize=15, fontweight='bold')

# Confusion Matrix
ax = axes[0]
cm = confusion_matrix(y_test, y_pred)
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=ax,
            xticklabels=['No Counseling', 'Needs Counseling'],
            yticklabels=['No Counseling', 'Needs Counseling'])
ax.set_title('Confusion Matrix', fontweight='bold')
ax.set_ylabel('Actual')
ax.set_xlabel('Predicted')

# ROC Curve
ax = axes[1]
fpr, tpr, _ = roc_curve(y_test, y_prob)
ax.plot(fpr, tpr, label=f"Gradient Boosting (AUC={roc:.3f})", color='#2ecc71', linewidth=2)
ax.plot([0, 1], [0, 1], 'k--', linewidth=1)
ax.set_title('ROC Curve', fontweight='bold')
ax.set_xlabel('False Positive Rate')
ax.set_ylabel('True Positive Rate')
ax.legend(fontsize=10)

# Feature Importance
ax = axes[2]
gb_clf = model.named_steps['clf']
importances = gb_clf.feature_importances_
feat_imp = pd.Series(importances, index=feature_names).sort_values(ascending=True).tail(10)
feat_imp.plot(kind='barh', ax=ax, color='#3498db', edgecolor='white')
ax.set_title('Top 10 Feature Importances\n(Gradient Boosting)', fontweight='bold')
ax.set_xlabel('Importance Score')

plt.tight_layout()
plt.savefig(rf'{BASE_PATH}\model_results.png', dpi=150, bbox_inches='tight')
plt.close()
print("\n✅ Model result plots saved")


joblib.dump(model, rf'{BASE_PATH}\counseling_model.pkl')
print(f"\n✅ Gradient Boosting model saved as counseling_model.pkl")


print("\n" + "=" * 60)
print("  DEMO: PREDICT FOR A NEW STUDENT")
print("=" * 60)

def predict_student(model, le_gender, le_activity, student_data: dict):
    """
    student_data: dict with all feature values
    Returns: prediction label + probability
    """
    df_input = pd.DataFrame([student_data])
    df_input['gender'] = le_gender.transform(df_input['gender'])
    df_input['physical_activity'] = le_activity.transform(df_input['physical_activity'])
    prob = model.predict_proba(df_input)[0][1]
    pred = model.predict(df_input)[0]
    label = "⚠️  NEEDS COUNSELING" if pred == 1 else "✅ No Counseling Needed"
    print(f"  Prediction : {label}")
    print(f"  Probability: {prob:.2%} chance of needing counseling")
    return pred, prob

# Example student at risk
student_at_risk = {
    'age': 20, 'gender': 'Male', 'cgpa': 4.5, 'attendance_pct': 52,
    'sleep_hours': 4.0, 'study_hours_per_day': 1, 'social_media_hours': 8.0,
    'physical_activity': 'Low', 'family_history_mental_illness': 1,
    'financial_stress': 5, 'academic_pressure': 5, 'relationship_issues': 1,
    'substance_use': 1, 'loneliness_score': 5, 'anxiety_score': 9,
    'depression_score': 8
}

print("\nStudent A (High Risk):")
predict_student(model, le_gender, le_activity, student_at_risk)

# Example healthy student
student_healthy = {
    'age': 21, 'gender': 'Female', 'cgpa': 8.2, 'attendance_pct': 88,
    'sleep_hours': 7.5, 'study_hours_per_day': 5, 'social_media_hours': 2.0,
    'physical_activity': 'High', 'family_history_mental_illness': 0,
    'financial_stress': 2, 'academic_pressure': 2, 'relationship_issues': 0,
    'substance_use': 0, 'loneliness_score': 2, 'anxiety_score': 3,
    'depression_score': 2
}

print("\nStudent B (Low Risk):")
predict_student(model, le_gender, le_activity, student_healthy)

print("\n" + "=" * 60)
print("  ✅ PIPELINE COMPLETE")
print("=" * 60)