import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import authRoutes from "./routes/authRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import exportRoutes from "./routes/exportRoutes.js";
import facultyRoutes from "./routes/facultyRoutes.js";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// API routes (order: auth → upload → analytics → admin → export → faculty)
app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/faculty", facultyRoutes);

// Global error handler (must be after routes; 4-arg handler)
app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "Payload Too Large",
        message: "File exceeds the maximum allowed size.",
      });
    }
    return res.status(400).json({
      error: "Bad Request",
      message: err.message || "File upload failed.",
    });
  }

  const clientStatus = err.statusCode ?? err.status;
  if (
    typeof clientStatus === "number" &&
    clientStatus >= 400 &&
    clientStatus < 500
  ) {
    return res.status(clientStatus).json({
      error: "Request Error",
      message: err.message || "Request could not be completed.",
    });
  }

  console.error("[server]", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred.",
  });
});

async function bootstrap() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI is required in .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    console.log("MongoDB connected");
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
