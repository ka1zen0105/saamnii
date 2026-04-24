import { api } from "./index.js";

export async function fetchAdminDashboard(params) {
  const { data } = await api.get("/api/admin/dashboard", { params });
  return data;
}

export async function fetchAdminExamUpdates() {
  const { data } = await api.get("/api/admin/exam-updates");
  return data?.updates ?? [];
}

export async function createAdminExamUpdate(message) {
  const { data } = await api.post("/api/admin/exam-updates", { message });
  return data;
}

export async function fetchAdminSettings() {
  const { data } = await api.get("/api/admin/settings");
  return data;
}

export async function patchAdminSettings(body) {
  const { data } = await api.patch("/api/admin/settings", body);
  return data;
}

export async function fetchAdminMeta(params) {
  const { data } = await api.get("/api/admin/meta", { params });
  return data;
}

export async function fetchFacultyOGradeDistribution(params) {
  const { data } = await api.get("/api/admin/faculty-o-grade-distribution", { params });
  return data?.distribution ?? [];
}

export async function fetchSemesterSubjectCatalog() {
  const { data } = await api.get("/api/admin/semester-subject-catalog");
  return data?.semesters ?? [];
}

export async function uploadSemesterSubjectCatalog(file, semester) {
  const form = new FormData();
  form.append("file", file);
  if (semester != null && String(semester).trim() !== "") {
    form.append("semester", String(semester));
  }
  const { data } = await api.post("/api/admin/semester-subject-catalog/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function downloadSemesterSubjectCatalogTemplate() {
  const { data } = await api.get("/api/admin/semester-subject-catalog/template", {
    responseType: "blob",
  });
  return data;
}

export async function fetchReviewRows(params) {
  const { data } = await api.get("/api/admin/review-rows", { params });
  return data;
}

export async function deleteAllMarksInDb() {
  return api.delete("/api/admin/students/marks", {
    headers: { "X-Confirm-Phrase": "DELETE_ALL_MARKS" },
  });
}

export async function fetchGradeBandsPooled(params) {
  const { data } = await api.get("/api/admin/grade-bands-pooled", { params });
  return data;
}

export async function downloadGradeBandsXlsx(params) {
  const { data } = await api.get("/api/analytics/grade-bands-xlsx", {
    params,
    responseType: "blob",
  });
  return data;
}

export async function listFaculty() {
  const { data } = await api.get("/api/admin/faculty");
  return data;
}

export async function createFaculty(body) {
  const { data } = await api.post("/api/admin/faculty", body);
  return data;
}

export async function deleteFaculty(userId) {
  return api.delete(`/api/admin/faculty/${encodeURIComponent(userId)}`);
}

export async function patchFacultySubjects(userId, subjectCodes) {
  const { data } = await api.patch(
    `/api/admin/faculty/${encodeURIComponent(userId)}/subjects`,
    { subjectCodes }
  );
  return data;
}

export async function patchFacultySemesterSubjects(userId, semester, subjectCodes) {
  const { data } = await api.patch(
    `/api/admin/faculty/${encodeURIComponent(userId)}/semester-subjects`,
    { semester, subjectCodes }
  );
  return data;
}

export async function patchFacultyClasses(userId, assignedClasses) {
  const { data } = await api.patch(
    `/api/admin/faculty/${encodeURIComponent(userId)}/classes`,
    { assignedClasses }
  );
  return data;
}

export async function listSchoolClasses() {
  const { data } = await api.get("/api/admin/classes");
  return data;
}

export async function createSchoolClass(body) {
  const { data } = await api.post("/api/admin/classes", body);
  return data;
}

export async function patchClassTeacher(classLabel, teacherUserId) {
  const { data } = await api.patch(
    `/api/admin/classes/${encodeURIComponent(classLabel)}/teacher`,
    { teacherUserId }
  );
  return data;
}

export async function patchClassCurriculum(classLabel, subjectsText) {
  const { data } = await api.patch(
    `/api/admin/classes/${encodeURIComponent(classLabel)}/curriculum`,
    { subjectsText }
  );
  return data;
}

export async function listFacultyUploadsForAdmin(userId) {
  const { data } = await api.get(`/api/admin/faculty/${encodeURIComponent(userId)}/uploads`);
  return data?.uploads ?? [];
}
