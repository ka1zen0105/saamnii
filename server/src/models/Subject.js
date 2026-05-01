import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    semester: { type: Number, required: true },
    subject_code: { type: String, required: true, trim: true },
    subject_name: { type: String, required: true, trim: true },
  },
  { collection: "subjects", timestamps: true }
);

subjectSchema.index({ semester: 1, subject_code: 1 }, { unique: true });
subjectSchema.index({ semester: 1 });

export const Subject = mongoose.model("Subject", subjectSchema);
