import { Router } from "express";
import { requireAdmin, verifyToken } from "../middleware/auth.js";
import { getGradeBandsXlsx } from "../controllers/exportController.js";

const router = Router();

router.use(verifyToken, requireAdmin);

router.get("/grade-bands-xlsx", getGradeBandsXlsx);

export default router;
