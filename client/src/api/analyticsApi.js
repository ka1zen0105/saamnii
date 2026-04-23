import { api } from "./index.js";

export async function fetchDashboard(params) {
  const { data } = await api.get("/api/analytics/dashboard", { params });
  return data;
}

export async function fetchExamUpdates() {
  const { data } = await api.get("/api/analytics/exam-updates");
  return data?.updates ?? [];
}

export async function fetchExamProgression(params) {
  const { data } = await api.get("/api/analytics/exam-progression", { params });
  return data;
}

export async function fetchBellCurve(params) {
  const { data } = await api.get("/api/analytics/bell-curve", { params });
  return data;
}

export async function fetchSubjectAvg(params) {
  const { data } = await api.get("/api/analytics/subject-avg", { params });
  return data;
}

export async function fetchGradeBands(params) {
  const { data } = await api.get("/api/analytics/grade-bands", { params });
  return data;
}

export async function fetchPercentageRanges(params) {
  const { data } = await api.get("/api/analytics/percentage-ranges", { params });
  return data;
}

export async function fetchUploadRecords(uploadId) {
  const { data } = await api.get(`/api/upload/${encodeURIComponent(uploadId)}/records`);
  return data;
}

export async function downloadOriginalUploadFile(uploadId) {
  const { data, headers } = await api.get(
    `/api/upload/${encodeURIComponent(uploadId)}/file`,
    { responseType: "blob" }
  );
  return { blob: data, headers };
}

export async function fetchMyUploads() {
  const { data } = await api.get("/api/upload/my-uploads");
  return data?.uploads ?? [];
}

export async function fetchUploadAnalytics(uploadId) {
  const { data } = await api.get(`/api/upload/${encodeURIComponent(uploadId)}/analytics`);
  return data;
}

export async function deleteUploadData(uploadId) {
  const { data } = await api.delete(`/api/upload/${encodeURIComponent(uploadId)}`);
  return data;
}

export async function askHelpChat(message, history = []) {
  const { data } = await api.post("/api/analytics/help-chat", { message, history });
  return data;
}
