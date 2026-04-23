import { useMemo } from "react";

export type QuestionId = string;
export type StudentId = string;
export type GraderId = string;

export interface ExamQuestion {
  id: QuestionId;
  maxScore: number;
  learningObjectiveTags: string[];
  label?: string;
}

export interface ExamData {
  id?: string;
  title?: string;
  questions: ExamQuestion[];
}

export interface StudentQuestionScore {
  questionId: QuestionId;
  score: number;
  graderId?: GraderId;
}

export interface StudentResult {
  studentId: StudentId;
  totalScore?: number;
  graderId?: GraderId;
  questionScores: StudentQuestionScore[];
}

export interface PsychometricRow {
  questionId: QuestionId;
  questionLabel: string;
  learningObjectiveTags: string[];
  maxScore: number;
  difficultyIndex: number;
  pointBiserial: number;
  isAnomalous: boolean;
}

export interface CompetencyPoint {
  tag: string;
  mastery: number;
  questionCount: number;
  evidenceCount: number;
}

export interface GraderVariance {
  graderAverages: Array<{ graderId: string; averagePercent: number; samples: number }>;
  stddevPercent: number;
  thresholdPercent: number;
  triggered: boolean;
}

export interface UseGradingAnalyticsArgs {
  exam: ExamData;
  studentResults: StudentResult[];
  anomalyDifficultyMin?: number;
  anomalyDifficultyMax?: number;
  graderStdDevThresholdPercent?: number;
}

export interface UseGradingAnalyticsResult {
  psychometrics: PsychometricRow[];
  anomalousQuestions: PsychometricRow[];
  competencyData: CompetencyPoint[];
  graderVariance: GraderVariance;
}

function clampScore(score: number, maxScore: number): number {
  if (!Number.isFinite(score)) return 0;
  if (!Number.isFinite(maxScore) || maxScore <= 0) return 0;
  return Math.min(Math.max(score, 0), maxScore);
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

export function useGradingAnalytics({
  exam,
  studentResults,
  anomalyDifficultyMin = 0.3,
  anomalyDifficultyMax = 0.9,
  graderStdDevThresholdPercent = 10,
}: UseGradingAnalyticsArgs): UseGradingAnalyticsResult {
  return useMemo(() => {
    const questions = Array.isArray(exam?.questions) ? exam.questions : [];
    const students = Array.isArray(studentResults) ? studentResults : [];
    const qCount = questions.length;

    if (qCount === 0 || students.length === 0) {
      return {
        psychometrics: [],
        anomalousQuestions: [],
        competencyData: [],
        graderVariance: {
          graderAverages: [],
          stddevPercent: 0,
          thresholdPercent: graderStdDevThresholdPercent,
          triggered: false,
        },
      };
    }

    const questionIndex = new Map<QuestionId, number>();
    const maxScores = new Float64Array(qCount);
    const questionTotals = new Float64Array(qCount);
    for (let i = 0; i < qCount; i += 1) {
      questionIndex.set(questions[i].id, i);
      maxScores[i] = Math.max(questions[i].maxScore || 0, 1);
    }

    const classTotalMax = Array.from(maxScores).reduce((acc, m) => acc + m, 0);
    const scoreMatrix: Float64Array[] = [];
    const studentTotals = new Float64Array(students.length);

    const tagAggregates = new Map<string, { sum: number; evidenceCount: number; qSet: Set<string> }>();
    const graderStudentBuckets = new Map<string, number[]>();
    const graderQuestionBuckets = new Map<string, number[]>();

    for (let s = 0; s < students.length; s += 1) {
      const result = students[s];
      const row = new Float64Array(qCount);

      for (const item of result.questionScores || []) {
        const idx = questionIndex.get(item.questionId);
        if (idx === undefined) continue;
        const raw = clampScore(item.score, maxScores[idx]);
        row[idx] = raw;

        if (item.graderId) {
          const percent = (raw / maxScores[idx]) * 100;
          const bucket = graderQuestionBuckets.get(item.graderId) || [];
          bucket.push(percent);
          graderQuestionBuckets.set(item.graderId, bucket);
        }
      }

      let computedTotal = 0;
      for (let i = 0; i < qCount; i += 1) {
        computedTotal += row[i];
        questionTotals[i] += row[i];
      }
      const totalRaw = Number.isFinite(result.totalScore) ? Number(result.totalScore) : computedTotal;
      studentTotals[s] = totalRaw;
      scoreMatrix.push(row);

      if (result.graderId) {
        const studentPercent =
          classTotalMax > 0 ? (Math.max(totalRaw, 0) / classTotalMax) * 100 : 0;
        const bucket = graderStudentBuckets.get(result.graderId) || [];
        bucket.push(studentPercent);
        graderStudentBuckets.set(result.graderId, bucket);
      }

      for (let i = 0; i < qCount; i += 1) {
        const question = questions[i];
        const proportion = row[i] / maxScores[i];
        for (const tag of question.learningObjectiveTags || []) {
          const key = String(tag || "").trim();
          if (!key) continue;
          const agg = tagAggregates.get(key) || {
            sum: 0,
            evidenceCount: 0,
            qSet: new Set<string>(),
          };
          agg.sum += proportion;
          agg.evidenceCount += 1;
          agg.qSet.add(question.id);
          tagAggregates.set(key, agg);
        }
      }
    }

    const psychometrics: PsychometricRow[] = [];
    for (let i = 0; i < qCount; i += 1) {
      const maxScore = maxScores[i];
      const difficultyIndex = questionTotals[i] / (students.length * maxScore);
      const denomYMax = Math.max(classTotalMax - maxScore, 1);

      let sumX = 0;
      let sumY = 0;
      let sumXX = 0;
      let sumYY = 0;
      let sumXY = 0;

      for (let s = 0; s < students.length; s += 1) {
        const raw = scoreMatrix[s][i];
        const x = raw / maxScore;
        const y = (studentTotals[s] - raw) / denomYMax;
        sumX += x;
        sumY += y;
        sumXX += x * x;
        sumYY += y * y;
        sumXY += x * y;
      }

      const n = students.length;
      const cov = n * sumXY - sumX * sumY;
      const varX = n * sumXX - sumX * sumX;
      const varY = n * sumYY - sumY * sumY;
      const pointBiserial =
        varX > 0 && varY > 0 ? cov / Math.sqrt(varX * varY) : 0;

      psychometrics.push({
        questionId: questions[i].id,
        questionLabel: questions[i].label || `Q${i + 1}`,
        learningObjectiveTags: questions[i].learningObjectiveTags || [],
        maxScore,
        difficultyIndex: round(difficultyIndex),
        pointBiserial: round(pointBiserial),
        isAnomalous:
          difficultyIndex < anomalyDifficultyMin || difficultyIndex > anomalyDifficultyMax,
      });
    }

    const competencyData: CompetencyPoint[] = Array.from(tagAggregates.entries())
      .map(([tag, agg]) => ({
        tag,
        mastery: round(agg.evidenceCount > 0 ? agg.sum / agg.evidenceCount : 0),
        questionCount: agg.qSet.size,
        evidenceCount: agg.evidenceCount,
      }))
      .sort((a, b) => b.mastery - a.mastery);

    const graderSource =
      graderStudentBuckets.size > 0 ? graderStudentBuckets : graderQuestionBuckets;
    const graderAverages = Array.from(graderSource.entries())
      .map(([graderId, arr]) => ({
        graderId,
        averagePercent: arr.length
          ? arr.reduce((acc, v) => acc + v, 0) / arr.length
          : 0,
        samples: arr.length,
      }))
      .filter((row) => row.samples > 0)
      .sort((a, b) => b.averagePercent - a.averagePercent);
    const stddevPercent = standardDeviation(graderAverages.map((g) => g.averagePercent));

    return {
      psychometrics,
      anomalousQuestions: psychometrics.filter((q) => q.isAnomalous),
      competencyData,
      graderVariance: {
        graderAverages: graderAverages.map((row) => ({
          ...row,
          averagePercent: round(row.averagePercent, 2),
        })),
        stddevPercent: round(stddevPercent, 2),
        thresholdPercent: graderStdDevThresholdPercent,
        triggered: stddevPercent > graderStdDevThresholdPercent,
      },
    };
  }, [
    exam,
    studentResults,
    anomalyDifficultyMin,
    anomalyDifficultyMax,
    graderStdDevThresholdPercent,
  ]);
}

