import type { GraderVariance } from "../hooks/useGradingAnalytics";

interface GraderVarianceAlertProps {
  variance: GraderVariance;
}

export function GraderVarianceAlert({ variance }: GraderVarianceAlertProps) {
  const isWarning = variance.triggered;

  return (
    <div
      className={[
        "rounded-xl border px-4 py-3 shadow-sm",
        isWarning
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="text-sm font-semibold">
        {isWarning ? "Grader Consistency Alert" : "Grader Consistency Stable"}
      </div>
      <p className="mt-1 text-sm">
        Standard deviation across grader averages:{" "}
        <span className="font-semibold">{variance.stddevPercent.toFixed(2)}%</span>
        {"  "} (threshold {variance.thresholdPercent.toFixed(2)}%).
      </p>

      {variance.graderAverages.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {variance.graderAverages.map((g) => (
            <span
              key={g.graderId}
              className="rounded-full border border-current/20 bg-white/70 px-2.5 py-1 text-xs"
            >
              {g.graderId}: {g.averagePercent.toFixed(1)}% ({g.samples})
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs opacity-80">No grader-attributed records available.</p>
      )}
    </div>
  );
}

