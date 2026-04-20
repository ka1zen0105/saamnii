import mongoose from "mongoose";

const semesterAssignmentSchema = new mongoose.Schema(
  {
    semester: { type: Number, required: true },
    subjectCodes: [{ type: String, trim: true }],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, trim: true },
  displayLabel: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  contact: { type: String, trim: true },
  role: { type: String, enum: ["admin", "faculty"] },
  /** bcrypt hash; omitted from queries unless .select("+passwordHash") */
  passwordHash: { type: String, select: false },
  subjectCodes: [{ type: String, trim: true }],
  semesterSubjectAssignments: [semesterAssignmentSchema],
  assignedClasses: [{ type: String, trim: true }],
});

export const User = mongoose.model("User", userSchema);
