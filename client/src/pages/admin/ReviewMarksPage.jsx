import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteAllMarksInDb,
  fetchAdminMeta,
  fetchReviewRows,
} from "../../api/adminApi.js";
import { SearchableSelect } from "../../components/SearchableSelect.jsx";
import { subjectDisplayName } from "../../utils/subjectLabel.js";
import "../../styles/facultyPages.css";
import "../../styles/adminPages.css";

const CONFIRM_PHRASE = "DELETE_ALL_MARKS";

export function ReviewMarksPage() {
  const [classLabel, setClassLabel] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [classes, setClasses] = useState([]);
  const [subjectCodes, setSubjectCodes] = useState([]);
  const [rows, setRows] = useState([]);
  const [approved, setApproved] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const params = useMemo(() => {
    const p = {};
    if (classLabel) p.classLabel = classLabel;
    if (subjectCode) p.subjectCode = subjectCode;
    return p;
  }, [classLabel, subjectCode]);

  const loadMeta = useCallback(async () => {
    try {
      const m = await fetchAdminMeta();
      setClasses(m?.classes ?? []);
      setSubjectCodes(m?.subjectCodes ?? []);
    } catch {
      setClasses([]);
      setSubjectCodes([]);
    }
  }, []);

  const loadRows = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const { rows: list } = await fetchReviewRows(params);
      setRows(Array.isArray(list) ? list : []);
      setApproved(new Map());
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load rows.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function toggleApprove(id, checked) {
    setApproved((prev) => {
      const next = new Map(prev);
      next.set(id, checked);
      return next;
    });
  }

  function removeAllMarkRows() {
    setRows([]);
  }

  function resetAllLocalData() {
    setApproved(new Map());
    loadRows();
  }

  async function deleteAllInDb() {
    if (confirmInput.trim() !== CONFIRM_PHRASE) return;
    setDeleteBusy(true);
    setErr("");
    try {
      await deleteAllMarksInDb();
      setDeleteOpen(false);
      setConfirmInput("");
      await loadRows();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Delete failed.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="faculty-page admin-page">
      <h1>Review marks</h1>
      <p className="sub">
        Inspect and approve rows locally. Destructive actions below affect stored data only
        when you confirm the database delete.
      </p>

      <div className="faculty-toolbar">
        <label>
          Class
          <SearchableSelect
            value={classLabel}
            onChange={setClassLabel}
            options={classes.map((c) => ({ value: c, label: c }))}
            placeholder="All Classes"
            searchPlaceholder="Search class label…"
          />
        </label>
        <label>
          Subject
          <SearchableSelect
            value={subjectCode}
            onChange={setSubjectCode}
            options={subjectCodes.map((c) => ({ value: c, label: subjectDisplayName(c) }))}
            placeholder="All Subjects"
            searchPlaceholder="Search code or subject name…"
          />
        </label>
      </div>

      <div className="review-actions">
        <button type="button" className="btn-muted" onClick={removeAllMarkRows}>
          Remove all mark rows
        </button>
        <button type="button" className="btn-muted" onClick={resetAllLocalData}>
          Reset all local data
        </button>
        <button type="button" className="btn-danger" onClick={() => setDeleteOpen(true)}>
          Delete all marks in DB
        </button>
      </div>

      {err ? (
        <div className="banner banner-error" role="alert">
          {err}
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <h3 style={{ marginTop: 0 }}>Delete all marks in database</h3>
            <p style={{ fontSize: "0.875rem", color: "#4b5563" }}>
              This removes every student record and every upload batch. Type{" "}
              <strong>{CONFIRM_PHRASE}</strong> to confirm.
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
            />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn-primary-sm"
                disabled={confirmInput.trim() !== CONFIRM_PHRASE || deleteBusy}
                onClick={deleteAllInDb}
              >
                {deleteBusy ? "Deleting…" : "Delete permanently"}
              </button>
              <button
                type="button"
                className="btn-muted"
                onClick={() => {
                  setDeleteOpen(false);
                  setConfirmInput("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="sub">Loading…</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Approve</th>
                <th>Name</th>
                <th>Roll</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Total</th>
                <th>%</th>
                <th>Grade</th>
                <th>Pass / Fail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={approved.get(r.id) ?? false}
                      onChange={(e) => toggleApprove(r.id, e.target.checked)}
                    />
                  </td>
                  <td>{r.name}</td>
                  <td>{r.roll}</td>
                  <td>{r.classLabel}</td>
                  <td>{r.subject || r.subjectCode}</td>
                  <td>{r.total ?? "—"}</td>
                  <td>{r.percentage != null ? r.percentage : "—"}</td>
                  <td>{r.grade}</td>
                  <td>{r.passFail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="sub" style={{ padding: "1rem" }}>
              No rows for this filter.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
