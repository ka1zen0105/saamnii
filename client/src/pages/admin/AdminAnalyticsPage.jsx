import { useEffect, useMemo, useState } from "react";
import { SubjectBellCurveChart } from "../../components/SubjectBellCurveChart.jsx";
import { SearchableSelect } from "../../components/SearchableSelect.jsx";
import { fetchUploadRecords } from "../../api/analyticsApi.js";
import { listFaculty, listFacultyUploadsForAdmin } from "../../api/adminApi.js";
import { parseRowsToSubjectData } from "../../utils/sheetParser.js";
import { toFacultySelectOption } from "../../utils/facultySelect.js";
import "../../styles/facultyPages.css";
import "../../styles/adminPages.css";

function canonicalSubjectCode(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const firstLine = raw.split(/\r?\n/)[0].trim();
  const firstToken = firstLine.split(/\s+/)[0].trim();
  return firstToken.toUpperCase();
}

export function AdminAnalyticsPage() {
  const [faculty, setFaculty] = useState([]);
  const [facultyId, setFacultyId] = useState("");
  const [uploads, setUploads] = useState([]);
  const [uploadId, setUploadId] = useState("");
  const [rows, setRows] = useState([]);
  const [semester, setSemester] = useState("");
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const semesterOptions = useMemo(() => {
    const vals = Array.from(
      new Set(
        (rows || [])
          .map((r) => (r?.semester == null ? "" : String(r.semester).trim()))
          .filter(Boolean)
      )
    );
    return vals.sort((a, b) => Number(a) - Number(b));
  }, [rows]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const list = await listFaculty();
        setFaculty(Array.isArray(list) ? list : []);
        setFacultyOptions(Array.isArray(list) ? list : []);
        if (list?.length) setFacultyId(list[0].userId);
      } catch (e) {
        setErr(e?.response?.data?.message || e.message || "Failed to load faculty list.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!facultyId) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const list = await listFacultyUploadsForAdmin(facultyId);
        setUploads(list);
        const pick = list[0]?.uploadId || "";
        setUploadId(pick);
        if (!pick) {
          setRows([]);
          return;
        }
        const rec = await fetchUploadRecords(pick);
        setRows(rec?.rows ?? []);
      } catch (e) {
        setErr(e?.response?.data?.message || e.message || "Failed to load faculty uploads.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [facultyId]);

  async function onSelectUpload(nextUploadId) {
    if (!nextUploadId) return;
    setLoading(true);
    setErr("");
    try {
      const rec = await fetchUploadRecords(nextUploadId);
      setUploadId(nextUploadId);
      setRows(rec?.rows ?? []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load selected upload.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const scopedRows = useMemo(() => {
    if (!semester) return rows;
    return (rows || []).filter((r) => String(r?.semester ?? "").trim() === semester);
  }, [rows, semester]);
  const parsedData = useMemo(() => parseRowsToSubjectData(scopedRows), [scopedRows]);
  const selectedFaculty = useMemo(
    () => faculty.find((f) => f.userId === facultyId) || null,
    [faculty, facultyId]
  );
  const preferredSubjectCode = useMemo(() => {
    const first = selectedFaculty?.subjectCodes?.[0];
    return canonicalSubjectCode(first);
  }, [selectedFaculty]);

  return (
    <div className="faculty-page admin-page">
      <h1>Analytics</h1>
      <p className="sub">Bell curve analytics for selected faculty upload.</p>

      {err ? (
        <div className="banner banner-error" role="alert">
          {err}
        </div>
      ) : null}

      <div className="faculty-toolbar">
        <label>
          Faculty
          <SearchableSelect
            value={facultyId}
            onChange={setFacultyId}
            options={facultyOptions.map(toFacultySelectOption)}
            disabled={loading}
            placeholder="No Faculty Available"
            searchPlaceholder="Search by name, email, or ID…"
          />
        </label>
        <label>
          Uploaded dataset
          <SearchableSelect
            value={uploadId}
            onChange={onSelectUpload}
            options={uploads.map((u) => ({
              value: u.uploadId,
              label: `${u.classLabel || "Class?"} • ${u.uploadId} • ${new Date(
                u.createdAt
              ).toLocaleString()}`,
            }))}
            disabled={loading || uploads.length === 0}
            placeholder="No Uploads Available"
            searchPlaceholder="Search class, upload ID, or date…"
          />
        </label>
        <label>
          Semester
          <SearchableSelect
            value={semester}
            onChange={setSemester}
            options={semesterOptions.map((s) => ({ value: s, label: s }))}
            disabled={loading}
            placeholder="All Semesters"
            searchPlaceholder="Type semester number…"
          />
        </label>
      </div>

      {loading ? (
        <p className="sub">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="sub">No uploaded records found for selected faculty.</p>
      ) : scopedRows.length === 0 ? (
        <p className="sub">No rows found for selected semester.</p>
      ) : (
        <SubjectBellCurveChart
          parsedData={parsedData}
          preferredSubjectCode={preferredSubjectCode}
        />
      )}
    </div>
  );
}
