import { useEffect, useMemo, useState } from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import "../styles/facultyPages.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

const COMPONENT_COLORS = {
  ISE: "#534AB7",
  MSE: "#0F6E56",
  ESE: "#993C1D",
  "PR/TU": "#185FA5",
};

function rgba(hex, a) {
  const s = hex.replace("#", "");
  const n = Number.parseInt(s, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function gaussian(x, mean, std) {
  if (!Number.isFinite(std) || std <= 0) return 0;
  const z = (x - mean) / std;
  return Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
}

function buildHistogram(percentages, binWidth) {
  const bins = [];
  for (let start = 0; start < 100; start += binWidth) {
    const end = Math.min(start + binWidth, 100);
    bins.push({ start, end, label: `${start}-${end}%`, count: 0 });
  }
  for (const v of percentages) {
    const clamped = Math.max(0, Math.min(100, v));
    const index = Math.min(bins.length - 1, Math.floor(clamped / binWidth));
    bins[index].count += 1;
  }
  return bins;
}

function canonicalSubjectCode(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const firstLine = raw.split(/\r?\n/)[0].trim();
  const firstToken = firstLine.split(/\s+/)[0].trim();
  return firstToken.toUpperCase();
}

export function SubjectBellCurveChart({ parsedData, preferredSubjectCode = "" }) {
  const subjectOptions = useMemo(() => Object.keys(parsedData ?? {}), [parsedData]);
  const [subject, setSubject] = useState(subjectOptions[0] || "");
  const [component, setComponent] = useState("");

  const currentSubject = parsedData?.[subject] ?? null;
  const componentOptions = useMemo(
    () => (currentSubject ? Object.keys(currentSubject) : []),
    [currentSubject]
  );

  useEffect(() => {
    if (!subject && subjectOptions.length) {
      setSubject(subjectOptions[0]);
    }
  }, [subject, subjectOptions]);

  useEffect(() => {
    const preferred = canonicalSubjectCode(preferredSubjectCode);
    if (!preferred || !subjectOptions.length) return;
    const match = subjectOptions.find((s) => {
      const codePart = String(s).split("—")[0]?.trim() ?? "";
      return canonicalSubjectCode(codePart) === preferred;
    });
    if (match) setSubject(match);
  }, [preferredSubjectCode, subjectOptions]);

  useEffect(() => {
    if ((!component || !componentOptions.includes(component)) && componentOptions.length) {
      setComponent(componentOptions[0]);
    }
  }, [component, componentOptions]);

  const compData = currentSubject?.[component];
  const chartPayload = useMemo(() => {
    if (!compData) return null;
    const n = compData.n;
    const binWidth = n >= 30 ? 10 : 15;
    const bins = buildHistogram(compData.percentages, binWidth);
    const labels = bins.map((b) => b.label);
    const histCounts = bins.map((b) => b.count);

    const curveValues = bins.map((b) => {
      const x = (b.start + b.end) / 2;
      return gaussian(x, compData.mean, compData.std) * n * binWidth;
    });
    const showCurve = compData.std > 0.5 && compData.n > 5;
    const color = COMPONENT_COLORS[component] || "#2563eb";

    return {
      labels,
      binWidth,
      showCurve,
      chartData: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Students",
            data: histCounts,
            backgroundColor: rgba(color, 0.6),
            borderColor: rgba(color, 0.95),
            borderWidth: 1,
            yAxisID: "y",
          },
          ...(showCurve
            ? [
                {
                  type: "line",
                  label: "Bell curve",
                  data: curveValues,
                  borderColor: color,
                  borderWidth: 2.5,
                  tension: 0.4,
                  pointRadius: 0,
                  yAxisID: "y",
                },
              ]
            : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          x: { title: { display: true, text: "Percentage range" } },
          y: {
            beginAtZero: true,
            title: { display: true, text: "No. of students" },
            ticks: { precision: 0 },
          },
        },
      },
    };
  }, [compData, component]);

  if (!subjectOptions.length) {
    return <p className="sub">No parsed subject data available for charting.</p>;
  }

  return (
    <section className="chart-card">
      <h2>Per-subject score distribution (histogram + bell curve)</h2>

      <div className="faculty-toolbar">
        <label>
          Subject
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {subjectOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="component-chip-row" role="tablist" aria-label="Component selection">
        {componentOptions.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={component === c}
            className={component === c ? "component-chip is-active" : "component-chip"}
            onClick={() => setComponent(c)}
          >
            {c === "PR/TU" ? "Tutorial / Practical" : c}
          </button>
        ))}
      </div>

      {!compData || !chartPayload ? (
        <p className="sub">No component data for this subject.</p>
      ) : (
        <>
          <div className="stats-row">
            <span>Mean: {compData.mean.toFixed(1)}%</span>
            <span>Median: {compData.median.toFixed(1)}%</span>
            <span>Std dev: ±{compData.std.toFixed(1)}%</span>
            <span>Pass rate: {compData.pass_rate.toFixed(1)}%</span>
            <span>Students: {compData.n}</span>
          </div>

          <div className="chart-wrap" style={{ height: 320 }}>
            <Chart type="bar" data={chartPayload.chartData} options={chartPayload.options} />
          </div>

          <p className="chart-hint" style={{ marginTop: "0.6rem" }}>
            Component: {component} · Max marks: {compData.max_marks} · n = {compData.n} entries ·
            {" "}Bin width: {chartPayload.binWidth}%
            {!chartPayload.showCurve ? " · Bell curve hidden (insufficient spread/data)." : ""}
          </p>
        </>
      )}
    </section>
  );
}

