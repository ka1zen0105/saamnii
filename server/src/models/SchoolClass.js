import mongoose from "mongoose";

const schoolClassSchema = new mongoose.Schema({
  classLabel: { type: String, required: true, unique: true, trim: true },
  teacherUserId: { type: String, trim: true },
  curriculum: [{ type: String, trim: true }],
});

export const SchoolClass = mongoose.model("SchoolClass", schoolClassSchema);
