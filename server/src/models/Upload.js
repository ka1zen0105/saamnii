import mongoose from "mongoose";

const uploadSchema = new mongoose.Schema({
  uploadId: { type: String, required: true, unique: true, trim: true },
  facultyId: { type: String, trim: true },
  originalFileName: { type: String, trim: true },
  fileMimeType: { type: String, trim: true },
  fileSizeBytes: Number,
  /** Raw uploaded workbook bytes (hidden by default in queries). */
  fileBuffer: { type: Buffer, select: false },
  classLabel: { type: String, trim: true },
  semester: Number,
  examMonth: { type: String, trim: true },
  examYear: Number,
  branch: { type: String, trim: true },
  rowCount: Number,
  createdAt: { type: Date, default: () => new Date() },
});

export const Upload = mongoose.model("Upload", uploadSchema);
