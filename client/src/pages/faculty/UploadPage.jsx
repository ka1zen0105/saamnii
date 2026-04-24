import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { api } from "../../api/index.js";
import {
  deleteUploadData,
  downloadOriginalUploadFile,
  fetchMyUploads,
  fetchUploadRecords,
} from "../../api/analyticsApi.js";
import { SearchableSelect } from "../../components/SearchableSelect.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import "../../styles/facultyPages.css";

function displayCell(v) {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "number") {
    if (Number.isInteger(v) && Math.abs(v) > 1e9) {
      try {
        return BigInt(Math.round(v)).toString();
      } catch {
        return String(v);
      }
    }
    return String(v);
  }
  const s = String(v).trim();
  if (/^[\d.]+[eE][+-]?\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n))
      try {
        return BigInt(Math.round(n)).toString();
      } catch {
        return String(Math.round(n));
      }
  }
  return s;
}

export function UploadPage() {
  const { user } = useAuth();
  const classes = user?.assignedClasses ?? [];
  const STORAGE_KEY = "faculty_last_upload_id";

  const [classLabel, setClassLabel] = useState("");
  const [banner, setBanner] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [currentUploadId, setCurrentUploadId] = useState("");

  const loadUploadData = useCallback(async (uploadId) => {
    if (!uploadId) return;
    const rec = await fetchUploadRecords(uploadId);
    setRows(rec?.rows ?? []);
    setCurrentUploadId(uploadId);
    localStorage.setItem(STORAGE_KEY, uploadId);
  }, []);

  const loadMyUploads = useCallback(async () => {
    const list = await fetchMyUploads();
    setUploads(list);
    if (!list.length) {
      setCurrentUploadId("");
      setRows([]);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    const pick = list.some((u) => u.uploadId === stored) ? stored : list[0].uploadId;
    await loadUploadData(pick);
  }, [loadUploadData]);

  useEffect(() => {
    loadMyUploads().catch((e) => {
      const msg = e?.response?.data?.message || e?.message || "Failed to load previous uploads.";
      setBanner({ type: "error", text: msg });
    });
  }, [loadMyUploads]);

  const onDrop = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setBanner({ type: "", text: "" });
      setRows([]);
      setBusy(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        if (classLabel.trim()) {
          formData.append("classLabel", classLabel.trim());
        }

        const res = await api.post("/api/upload", formData, {
          headers: {},
        });

        const data = res.data;
        const uploadId = data?.uploadId;

        if (!uploadId) {
          throw new Error("No upload id returned.");
        }
        setBanner({
          type: "success",
          text: `Upload successful. ${data.rowCount ?? 0} student rows, ${data.subjectsFound ?? 0} subject entries.`,
        });
        await loadMyUploads();
        await loadUploadData(uploadId);

      } catch (e) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Upload failed. Check file format or login.";

        setBanner({ type: "error", text: msg });
      } finally {
        setBusy(false);
      }
    },
    [classLabel, loadMyUploads, loadUploadData]
  );

  async function onDownloadOriginal() {
    if (!currentUploadId) return;
    try {
      const { blob, headers } = await downloadOriginalUploadFile(currentUploadId);
      const disposition = String(headers?.["content-disposition"] || "");
      const m = disposition.match(/filename="?([^"]+)"?/i);
      const fallback = `${currentUploadId}.xlsx`;
      const filename = (m?.[1] || fallback).replace(/[\\/:*?"<>|]/g, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg =
        e?.response?.data?.message || e?.message || "Could not download original file.";
      setBanner({ type: "error", text: msg });
    }
  }

  async function onSelectUpload(uploadId) {
    if (!uploadId) return;
    setBusy(true);
    setBanner({ type: "", text: "" });
    try {
      await loadUploadData(uploadId);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Could not load upload.";
      setBanner({ type: "error", text: msg });
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteCurrentUpload() {
    if (!currentUploadId) return;
    const ok = window.confirm(
      "Delete this uploaded dataset and all extracted records? This cannot be undone."
    );
    if (!ok) return;
    setBusy(true);
    setBanner({ type: "", text: "" });
    try {
      await deleteUploadData(currentUploadId);
      setBanner({ type: "success", text: "Upload deleted." });
      await loadMyUploads();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Could not delete upload.";
      setBanner({ type: "error", text: msg });
    } finally {
      setBusy(false);
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    disabled: busy,
  });

  return (
    <div className="faculty-page">
      <h1>Upload Results</h1>
      <p className="sub">
        Drop an Excel workbook (.xlsx). Parsed rows appear below after a successful upload.
      </p>

      <div className="faculty-toolbar">
        <label>
          Class Label (Optional)
          <SearchableSelect
            value={classLabel}
            onChange={setClassLabel}
            options={classes.map((c) => ({ value: c, label: c }))}
            disabled={busy}
            placeholder="Derive from Sheet / Default"
            searchPlaceholder="Search Class..."
          />
        </label>
        <label>
          Uploaded Dataset
          <SearchableSelect
            value={currentUploadId}
            onChange={onSelectUpload}
            options={uploads.map((u) => ({
              value: u.uploadId,
              label: `${u.classLabel || "Class?"} • ${u.uploadId} • ${new Date(
                u.createdAt
              ).toLocaleString()}`,
            }))}
            disabled={busy || uploads.length === 0}
            placeholder="No Uploads Yet"
            searchPlaceholder="Search Upload..."
          />
        </label>
      </div>

      {banner.type ? (
        <div
          className={`banner ${
            banner.type === "success" ? "banner-success" : "banner-error"
          }`}
          role="status"
        >
          {banner.text}
        </div>
      ) : null}

      {currentUploadId ? (
        <div style={{ marginBottom: "0.75rem", display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn-png" onClick={onDownloadOriginal}>
            Download Original Uploaded File
          </button>
          <button type="button" className="btn-danger" onClick={onDeleteCurrentUpload}>
            Delete This Upload
          </button>
        </div>
      ) : null}

      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? "dropzone-active" : ""}`}
      >
        <input {...getInputProps()} />
        <strong>Drag &amp; Drop a .xlsx File Here</strong>
        <p>Or Click to Browse. Only .xlsx Is Accepted.</p>
      </div>

      {busy ? <p className="sub">Processing…</p> : null}

      {rows.length > 0 && (
        <>
          <h2 style={{ marginTop: "1.5rem", fontSize: "1rem", color: "#374151" }}>
            Uploaded File Data
          </h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>ROLL</th>
                  <th>CLASS</th>
                  <th>SUBJECT</th>
                  <th>ISE1</th>
                  <th>ISE2</th>
                  <th>MSE</th>
                  <th>ESE</th>
                  <th>TOTAL</th>
                  <th>%</th>
                  <th>GRADE</th>
                  <th>PASS/FAIL</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.roll}-${r.subject}-${i}`}>
                    <td>{displayCell(r.name)}</td>
                    <td>{displayCell(r.roll)}</td>
                    <td>{displayCell(r.classLabel)}</td>
                    <td>{displayCell(r.subject)}</td>
                    <td>{displayCell(r.ise1)}</td>
                    <td>{displayCell(r.ise2)}</td>
                    <td>{displayCell(r.mse)}</td>
                    <td>{displayCell(r.ese)}</td>
                    <td>{displayCell(r.total)}</td>
                    <td>{displayCell(r.percentage)}</td>
                    <td>{displayCell(r.grade)}</td>
                    <td>{displayCell(r.passFail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}