import { Router } from "express";
import { requireAdmin, verifyToken } from "../middleware/auth.js";
import * as admin from "../controllers/adminController.js";

const router = Router();

router.use(verifyToken, requireAdmin);

router.get("/meta", admin.getAdminMeta);
router.get("/faculty-o-grade-distribution", admin.getFacultyOGradeDistribution);
router.get("/semester-subject-catalog", admin.getSemesterSubjectCatalog);
router.get("/dashboard", admin.getAdminDashboard);
router.get("/exam-updates", admin.getExamUpdates);
router.post("/exam-updates", admin.createExamUpdate);
router.get("/settings", admin.getSettings);
router.patch("/settings", admin.patchSettings);
router.get("/review-rows", admin.getReviewRows);
router.delete("/students/marks", admin.deleteAllMarks);
router.get("/grade-bands-pooled", admin.getGradeBandsPooled);
router.get("/grade-bands-xlsx", admin.getGradeBandsXlsx);

router.get("/faculty", admin.listFaculty);
router.get("/faculty/:userId/uploads", admin.listFacultyUploads);
router.post("/faculty", admin.createFaculty);
router.patch("/faculty/:userId/subjects", admin.patchFacultySubjects);
router.patch(
  "/faculty/:userId/semester-subjects",
  admin.patchFacultySemesterSubjects
);
router.patch("/faculty/:userId/classes", admin.patchFacultyClasses);

router.get("/classes", admin.listClasses);
router.post("/classes", admin.createClass);
router.patch("/classes/:classLabel/teacher", admin.patchClassTeacher);
router.patch("/classes/:classLabel/curriculum", admin.patchClassCurriculum);

export default router;
