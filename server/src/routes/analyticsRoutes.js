import { Router } from "express";
import { requireAdmin, verifyToken } from "../middleware/auth.js";
import {
  getBellCurve,
  getDashboard,
  getExamUpdates,
  getExamProgression,
  postHelpChat,
  getGradeBands,
  getOverallPercentageRanges,
  getSubjectAvg,
} from "../controllers/analyticsController.js";
import { getGradeBandsXlsx } from "../controllers/adminController.js";

const router = Router();

router.use(verifyToken);

router.get("/dashboard", getDashboard);
router.get("/exam-updates", getExamUpdates);
router.get("/grade-bands", getGradeBands);
router.get("/bell-curve", getBellCurve);
router.get("/percentage-ranges", getOverallPercentageRanges);
router.get("/subject-avg", getSubjectAvg);
router.get("/exam-progression", getExamProgression);
router.post("/help-chat", postHelpChat);
/** Admin-only alias for workbook export (same handler as GET /api/admin/grade-bands-xlsx). */
router.get("/grade-bands-xlsx", requireAdmin, getGradeBandsXlsx);

export default router;
