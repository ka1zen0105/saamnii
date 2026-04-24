import { Router } from "express";
import multer from "multer";
import { requireAdmin, verifyToken } from "../middleware/auth.js";
import * as admin from "../controllers/adminController.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const name = (file.originalname || "").toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      const err = new Error("Only Excel files (.xlsx or .xls) are allowed.");
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.use(verifyToken, requireAdmin);

router.get("/meta", admin.getAdminMeta);
router.get("/faculty-o-grade-distribution", admin.getFacultyOGradeDistribution);
router.get("/semester-subject-catalog", admin.getSemesterSubjectCatalog);
router.get(
  "/semester-subject-catalog/template",
  admin.downloadSemesterSubjectCatalogTemplate
);
router.post(
  "/semester-subject-catalog/upload",
  upload.single("file"),
  admin.uploadSemesterSubjectCatalog
);
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
