import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  downloadGradeBandsXlsx,
  fetchAdminMeta,
  fetchGradeBandsPooled,
  listFaculty,
} from "../../api/adminApi.js";
import "../../styles/facultyPages.css";
import "../../styles/adminPages.css";
import { downloadElementAsPng } from "../../utils/exportPng.js";
import { SearchableSelect } from "../../components/SearchableSelect.jsx";
import { subjectDisplayName } from "../../utils/subjectLabel.js";

function BandCard({ subject }) {
  const cardRef = useRef(null);
  const rows = subject?.bands ?? [];
  async function onDownloadPng() {
    await downloadElementAsPng(
      cardRef.current,
      `${subject?.subjectCode || subject?.subjectName || "subject"}-admin-grade-bands`
    );
  }
  return (
    <div className="chart-card" style={{ marginBottom: "1rem" }} ref={cardRef}>
      <h3 style={{ marginTop: 0, fontSize: "1rem" }}>
        {subject.subjectCode || subject.subjectName || "Subject"}
      </h3>
      <div style={{ marginBottom: "0.5rem" }}>
        <button type="button" className="btn-png" onClick={onDownloadPng}>
          Download PNG
        </button>
      </div>
      <div className="chart-wrap" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows.map((b) => ({
              label: b.label,
              total: b.total ?? 0,
            }))}
            margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 8 }} angle={-25} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="total" fill="#4f46e5" name="Count" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AdminGradeBandsPage() {
  const pooledCaptureRef = useRef(null);
  const [classLabel, setClassLabel] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [meta, setMeta] = useState({ classes: [], subjectCodes: [] });
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [pooledBands, setPooledBands] = useState([]);
  const [perSubject, setPerSubject] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [downloading, setDownloading] = useState(false);

  const params = useMemo(() => {
    const p = {};
    if (facultyId) p.facultyId = facultyId;
    if (classLabel) p.classLabel = classLabel;
    if (subjectCode) p.subjectCode = subjectCode;
    return p;
  }, [facultyId, classLabel, subjectCode]);

  const loadMeta = useCallback(async () => {
    try {
      const [m, faculty] = await Promise.all([fetchAdminMeta(params), listFaculty()]);
      setMeta({ classes: m?.classes ?? [], subjectCodes: m?.subjectCodes ?? [] });
      setFacultyOptions(Array.isArray(faculty) ? faculty : []);
    } catch {
      setMeta({ classes: [], subjectCodes: [] });
      setFacultyOptions([]);
    }
  }, [params]);

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const data = await fetchGradeBandsPooled(params);
      setPooledBands(data?.pooledBands ?? []);
      setPerSubject(Array.isArray(data?.perSubject) ? data.perSubject : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load grade bands.");
      setPooledBands([]);
      setPerSubject([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDownload() {
    setDownloading(true);
    try {
      const blob = await downloadGradeBandsXlsx(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "grade-bands.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  const pooledChart = useMemo(
    () =>
      (pooledBands ?? []).map((b) => ({
        label: b.label,
        symbol: b.gradeSymbol,
        total: b.total ?? 0,
      })),
    [pooledBands]
  );

  async function onDownloadPooledPng() {
    await downloadElementAsPng(
      pooledCaptureRef.current,
      `all-subjects-pooled-grade-bands`
    );
  }

  return (
    <div className="faculty-page admin-page">
      <h1>Grade Bands</h1>
      <p className="sub">
        Pooled distribution across subjects in scope, plus per-subject breakdown. Export matches
        the same filters.
      </p>

      <div className="faculty-toolbar">
        <label>
          Faculty
          <SearchableSelect
            value={facultyId}
            onChange={(nextFacultyId) => {
              setFacultyId(nextFacultyId);
              setClassLabel("");
              setSubjectCode("");
            }}
            options={facultyOptions.map((f) => ({
              value: f.userId,
              label: `${f.userId}${f.displayLabel ? ` — ${f.displayLabel}` : ""}`,
            }))}
            placeholder="All Faculty"
            searchPlaceholder="Search Faculty..."
          />
        </label>
        <label>
          Class
          <SearchableSelect
            value={classLabel}
            onChange={setClassLabel}
            options={meta.classes.map((c) => ({ value: c, label: c }))}
            placeholder="All Classes"
            searchPlaceholder="Search Class..."
          />
        </label>
        <label>
          Subject
          <SearchableSelect
            value={subjectCode}
            onChange={setSubjectCode}
            options={meta.subjectCodes.map((c) => ({ value: c, label: subjectDisplayName(c) }))}
            placeholder="All Subjects (Pooled)"
            searchPlaceholder="Search Subject..."
          />
        </label>
        <button
          type="button"
          className="btn-primary-sm"
          onClick={onDownload}
          disabled={downloading}
        >
          {downloading ? "Preparing…" : "Download Grade-Band Workbook (XLSX)"}
        </button>
      </div>
      <p className="chart-hint">
        Workbook is generated from <code>GET /api/analytics/grade-bands-xlsx</code> (admin
        only) with the same class/subject query params.
      </p>

      {err ? (
        <div className="banner banner-error" role="alert">
          {err}
        </div>
      ) : null}

      {loading ? (
        <p className="sub">Loading…</p>
      ) : (
        <>
          <div className="chart-card" ref={pooledCaptureRef}>
            <h2>Combined band distribution (total %)</h2>
            <p className="chart-hint">All subject rows in scope pooled into one histogram.</p>
            <div style={{ marginBottom: "0.5rem" }}>
              <button type="button" className="btn-png" onClick={onDownloadPooledPng}>
                Download PNG
              </button>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pooledChart} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9 }}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#6366f1" name="Students" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h2 className="section-title">Per-subject grade bands</h2>
          {perSubject.length === 0 ? (
            <p className="sub">No subjects in scope.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "1rem",
              }}
            >
              {perSubject.map((sub) => (
                <BandCard key={sub.subjectCode || sub.subjectName} subject={sub} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
