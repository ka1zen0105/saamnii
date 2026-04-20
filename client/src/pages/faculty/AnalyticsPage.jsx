import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMyUploads, fetchUploadRecords } from "../../api/analyticsApi.js";
import { SubjectBellCurveChart } from "../../components/SubjectBellCurveChart.jsx";
import { parseRowsToSubjectData } from "../../utils/sheetParser.js";
import "../../styles/facultyPages.css";

export function AnalyticsPage() {
  const [uploads, setUploads] = useState([]);
  const [currentUploadId, setCurrentUploadId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const parsedData = useMemo(() => parseRowsToSubjectData(rows), [rows]);

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
        <SubjectBellCurveChart parsedData={parsedData} />
      )}
    </div>
  );
}
