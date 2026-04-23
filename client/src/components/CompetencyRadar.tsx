import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CompetencyPoint } from "../hooks/useGradingAnalytics";

interface CompetencyRadarProps {
  data: CompetencyPoint[];
  title?: string;
}

export function CompetencyRadar({
  data,
  title = "Competency Mapping",
}: CompetencyRadarProps) {
  const chartData = data.map((d) => ({
    tag: d.tag,
    masteryPct: Number((d.mastery * 100).toFixed(1)),
    questionCount: d.questionCount,
  }));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="tag" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Radar
              name="Mastery"
              dataKey="masteryPct"
              stroke="#2563eb"
              fill="#3b82f6"
              fillOpacity={0.3}
            />
            <Tooltip
              formatter={(value: number, _name, item) => [
                `${Number(value).toFixed(1)}%`,
                `${item?.payload?.questionCount ?? 0} questions`,
              ]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

