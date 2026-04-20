import { Router } from "express";
import { verifyToken, requireFaculty } from "../middleware/auth.js";
import { getMyProfile, patchMyProfile } from "../controllers/facultyController.js";

const router = Router();

router.use(verifyToken, requireFaculty);

router.get("/me", getMyProfile);
router.patch("/me", patchMyProfile);

export default router;

