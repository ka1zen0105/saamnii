import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "app" },
    publishResults: { type: Boolean, default: false },
  },
  { collection: "settings" }
);

export const Settings = mongoose.model("Settings", settingsSchema);
