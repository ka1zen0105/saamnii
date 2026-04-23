import type { PsychometricRow } from "../hooks/useGradingAnalytics";

interface PsychometricTableProps {
  rows: PsychometricRow[];
  showOnlyAnomalies?: boolean;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function PsychometricTable({
  rows,
  showOnlyAnomalies = false,
}: PsychometricTableProps) {
  const visibleRows = showOnlyAnomalies ? rows.filter((r) => r.isAnomalous) : rows;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Psychometric Analysis</h3>
        <span className="text-xs text-slate-500">
          {visibleRows.length} question{visibleRows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Question</th>
              <th className="px-4 py-2.5">Difficulty</th>
              <th className="px-4 py-2.5">Point Biserial</th>
              <th className="px-4 py-2.5">Learning Objectives</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={5}>
                  No rows to display.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.questionId}
                  className={row.isAnomalous ? "bg-amber-50/40" : undefined}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{row.questionLabel}</td>
                  <td className="px-4 py-3 text-slate-700">{pct(row.difficultyIndex)}</td>
                  <td className="px-4 py-3 text-slate-700">{row.pointBiserial.toFixed(3)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {(row.learningObjectiveTags || []).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.isAnomalous ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                        Anomalous
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                        Normal
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

