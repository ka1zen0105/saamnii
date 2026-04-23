import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "app" },
    publishResults: { type: Boolean, default: false },
    examUpdates: [
      {
        message: { type: String, trim: true },
        published: { type: Boolean, default: true },
        createdAt: { type: Date, default: () => new Date() },
        createdBy: { type: String, trim: true },
      },
    ],
  },
  { collection: "settings" }
);

export const Settings = mongoose.model("Settings", settingsSchema);
