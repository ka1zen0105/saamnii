import { Router } from "express";
import { requireAdmin, verifyToken } from "../middleware/auth.js";
import {
  getSubjectSemesters,
  getSubjectsBySemester,
} from "../controllers/subjectsController.js";

const router = Router();

router.use(verifyToken, requireAdmin);
router.get("/semesters", getSubjectSemesters);
router.get("/", getSubjectsBySemester);

export default router;
