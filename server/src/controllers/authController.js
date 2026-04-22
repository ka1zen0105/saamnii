import jwt from "jsonwebtoken";
import { SE_ECS_FACULTY } from "../data/seEcsFaculty.js";

function unauthorized(res) {
  return res.status(401).json({
    error: "Unauthorized",
    message: "Invalid credentials.",
  });
}

function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS;
  const configured = raw
    ? String(raw)
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    : [];
  if (configured.length > 0) return configured;
  return ["admin@frcrce.ac.in"];
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body ?? {};

    if (
      email === undefined ||
      email === null ||
      typeof email !== "string" ||
      !email.trim()
    ) {
      return unauthorized(res);
    }

    if (password === undefined || password === null || typeof password !== "string") {
      return unauthorized(res);
    }

    const normalizedEmail = email.trim().toLowerCase();

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[auth] JWT_SECRET is not configured");
      return res.status(500).json({
        error: "Server configuration error",
        message: "Authentication is not configured.",
      });
    }

    if (password !== "teacher123") {
      return unauthorized(res);
    }

    const adminEmails = getAdminEmails();
    if (adminEmails.includes(normalizedEmail)) {
      const payload = {
        userId: normalizedEmail,
        role: "admin",
        subjectCodes: [],
        assignedClasses: [],
        name: "Admin",
        email: normalizedEmail,
        contact: null,
      };
      const token = jwt.sign(payload, secret, { expiresIn: "7d" });
      return res.json({
        token,
        user: payload,
      });
    }

    const mentor = SE_ECS_FACULTY.find(
      (item) => item?.email && String(item.email).trim().toLowerCase() === normalizedEmail
    );
    if (!mentor) {
      return unauthorized(res);
    }

    const payload = {
      userId: normalizedEmail,
      role: "faculty",
      subjectCodes: [],
      assignedClasses: [],
      name: mentor.name,
      email: mentor.email,
      contact: mentor.contact,
    };

    const token = jwt.sign(payload, secret, { expiresIn: "7d" });
    return res.json({
      token,
      user: payload,
    });
  } catch (err) {
    next(err);
  }
}
