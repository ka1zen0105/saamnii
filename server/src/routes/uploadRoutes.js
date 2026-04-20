import { Router } from "express";
import multer from "multer";
import { requireFaculty, verifyToken } from "../middleware/auth.js";
import {
  deleteUpload,
  downloadUploadFile,
  getMyUploads,
  getUploadAnalytics,
  getUploadRecords,
} from "../controllers/uploadRecordsController.js";
import { uploadSpreadsheet } from "../controllers/uploadController.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    // MongoDB document limit is 16MB; keep room for metadata + parsed data.
    fileSize: 14 * 1024 * 1024,
  },
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

const router = Router();

router.get("/my-uploads", verifyToken, requireFaculty, getMyUploads);
router.get(
  "/:uploadId/records",
  verifyToken,
  requireFaculty,
  getUploadRecords
);
router.get("/:uploadId/analytics", verifyToken, getUploadAnalytics);

router.get("/:uploadId/file", verifyToken, downloadUploadFile);
router.delete("/:uploadId", verifyToken, deleteUpload);

router.post(
  "/",
  verifyToken,
  requireFaculty,
  upload.single("file"),
  uploadSpreadsheet
);

export default router;
