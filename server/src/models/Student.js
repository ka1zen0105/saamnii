import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true },
    name: { type: String, trim: true },
    internal: Number,
    ise2: Number,
    mse: Number,
    external: Number,
    total: Number,
    grade: { type: String, trim: true },
    credits: Number,
    result: { type: String, trim: true },
  },
  { _id: false }
);

const studentSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  prn: { type: String, trim: true },
  seatNo: { type: String, trim: true },
  semester: Number,
  examMonth: { type: String, trim: true },
  examYear: Number,
  branch: { type: String, trim: true },
  sgpa: Number,
  cgpa: Number,
  totalMarks: Number,
  percentage: Number,
  result: { type: String, trim: true },
  uploadId: { type: String, trim: true },
  classLabel: { type: String, trim: true },
  subjects: [subjectSchema],
});

studentSchema.index({ prn: 1 });
studentSchema.index({ classLabel: 1 });
studentSchema.index({ semester: 1 });
studentSchema.index({ uploadId: 1 });

export const Student = mongoose.model("Student", studentSchema);
