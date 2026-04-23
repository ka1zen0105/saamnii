import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMyUploads, fetchUploadRecords } from "../../api/analyticsApi.js";
import { SubjectBellCurveChart } from "../../components/SubjectBellCurveChart.jsx";
import { PsychometricTable } from "../../components/PsychometricTable";
import { CompetencyRadar } from "../../components/CompetencyRadar";
import { GraderVarianceAlert } from "../../components/GraderVarianceAlert";
import { useGradingAnalytics } from "../../hooks/useGradingAnalytics";
import { parseRowsToSubjectData } from "../../utils/sheetParser.js";
import "../../styles/facultyPages.css";

function toFinite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function componentSpecsFromRow(row) {
  const code = String(row?.subjectCode || row?.subject || "SUB").trim() || "SUB";
  const name = String(row?.subject || row?.subjectCode || "Subject").trim() || "Subject";
  const tag = code;
  return [
    { key: `${code}|ISE1`, label: `${code} ISE-TH`, maxScore: 40, score: toFinite(row?.ise1), tags: [tag, name] },
    { key: `${code}|ISE2`, label: `${code} ISE-TUT`, maxScore: 50, score: toFinite(row?.ise2), tags: [tag, name] },
    { key: `${code}|MSE`, label: `${code} MSE`, maxScore: 30, score: toFinite(row?.mse), tags: [tag, name] },
    { key: `${code}|ESE`, label: `${code} ESE`, maxScore: 30, score: toFinite(row?.ese), tags: [tag, name] },
  ];
}

export function AnalyticsPage() {
  const [uploads, setUploads] = useState([]);
  const [currentUploadId, setCurrentUploadId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const parsedData = useMemo(() => parseRowsToSubjectData(rows), [rows]);
  const analyticsInput = useMemo(() => {
    const questionMap = new Map();
    const studentMap = new Map();
    let unknownCounter = 0;

    for (const row of rows || []) {
      const studentId =
        String(row?.roll || row?.prn || row?.name || "").trim() ||
        `student-row-${++unknownCounter}`;
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          studentId,
          graderId: row?.graderId || row?.taId || row?.evaluatorId || undefined,
          questionScores: [],
        });
      }
      const student = studentMap.get(studentId);

      for (const spec of componentSpecsFromRow(row)) {
        if (spec.score == null) continue;
        if (!questionMap.has(spec.key)) {
          questionMap.set(spec.key, {
            id: spec.key,
            label: spec.label,
            maxScore: spec.maxScore,
            learningObjectiveTags: spec.tags,
          });
        }
        student.questionScores.push({
          questionId: spec.key,
          score: spec.score,
          graderId: student.graderId,
        });
      }
    }

    return {
      exam: {
        id: currentUploadId || "upload-analytics",
        title: "Upload psychometric model",
        questions: Array.from(questionMap.values()),
      },
      studentResults: Array.from(studentMap.values()),
    };
  }, [rows, currentUploadId]);

  const { psychometrics, anomalousQuestions, competencyData, graderVariance } =
    useGradingAnalytics({
      exam: analyticsInput.exam,
      studentResults: analyticsInput.studentResults,
      graderStdDevThresholdPercent: 10,
    });

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const list = await fetchMyUploads();
      setUploads(list);
      const pick = list[0]?.uploadId || "";
      if (!pick) {
        setCurrentUploadId("");
        setRows([]);
        return;
      }
      setCurrentUploadId(pick);
      const rec = await fetchUploadRecords(pick);
      setRows(rec?.rows ?? []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load analytics data.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSelectUpload(uploadId) {
    if (!uploadId) return;
    setLoading(true);
    setErr("");
    try {
      const rec = await fetchUploadRecords(uploadId);
      setCurrentUploadId(uploadId);
      setRows(rec?.rows ?? []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load selected upload.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="faculty-page">
      <h1>Analytics</h1>
      <p className="sub">Per-subject histogram with fitted bell curve for uploaded results.</p>

      <div className="faculty-toolbar">
        <label>
          Uploaded dataset
          <select
            value={currentUploadId}
            onChange={(e) => onSelectUpload(e.target.value)}
            disabled={loading || uploads.length === 0}
          >
            {uploads.length === 0 ? (
              <option value="">No uploads available</option>
            ) : (
              uploads.map((u) => (
                <option key={u.uploadId} value={u.uploadId}>
                  {u.classLabel || "Class?"} • {u.uploadId} • {new Date(u.createdAt).toLocaleString()}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      {currentUploadId ? (
        <div className="stats-row">
          <span>Upload: {currentUploadId}</span>
          <span>
            Subjects: {Object.keys(parsedData).length}
          </span>
          <span>Rows: {rows.length}</span>
          <span>
            Class: {uploads.find((u) => u.uploadId === currentUploadId)?.classLabel || "N/A"}
          </span>
        </div>
      ) : null}

      {err ? (
        <div className="banner banner-error" role="alert">
          {err}
        </div>
      ) : null}

      {loading ? (
        <p className="sub">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="sub">No uploaded records found. Upload a file first.</p>
      ) : (
        <>
          <SubjectBellCurveChart parsedData={parsedData} />

          <div className="chart-card">
            <h2>Grader consistency audit</h2>
            <GraderVarianceAlert variance={graderVariance} />
          </div>

          <div className="chart-card">
            <h2>Competency mapping</h2>
            <CompetencyRadar data={competencyData} />
          </div>

          <div className="chart-card">
            <h2>Psychometric analysis</h2>
            <p className="chart-hint" style={{ marginBottom: "0.6rem" }}>
              Anomalous questions: {anomalousQuestions.length} / {psychometrics.length}
            </p>
            <PsychometricTable rows={psychometrics} />
          </div>
        </>
      )}
    </div>
  );
}
