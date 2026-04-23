import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { SE_ECS_FACULTY } from "../data/seEcsFaculty.js";

function unauthorized(res) {
  return res.status(401).json({
    error: "Unauthorized",
    message: "Invalid email or password.",
  });
}

function splitCsvEnv(key) {
  const raw = process.env[key];
  return raw
    ? String(raw)
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    : [];
}

function normalizeIdentifier(v) {
  return String(v || "").trim().toLowerCase();
}

async function isAdminLoginMatch(identifier, password) {
  const adminId = normalizeIdentifier(process.env.ADMIN_ID);
  const adminEmails = splitCsvEnv("ADMIN_EMAILS");
  const isKnownAdminIdentifier =
    (adminId && identifier === adminId) || adminEmails.includes(identifier);
  if (!isKnownAdminIdentifier) return false;

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash && typeof hash === "string" && hash.trim()) {
    return bcrypt.compare(password, hash);
  }

  const plain = process.env.ADMIN_PASSWORD;
  if (typeof plain === "string" && plain.length > 0) {
    return password === plain;
  }

  return false;
}

/**
 * POST /api/auth/login
 * Body: { email|userId, password }
 */
export async function login(req, res, next) {
  try {
    const rawIdentifier = req.body?.email ?? req.body?.userId;
    const { password } = req.body ?? {};

    if (
      rawIdentifier === undefined ||
      rawIdentifier === null ||
      typeof rawIdentifier !== "string" ||
      !rawIdentifier.trim()
    ) {
      return unauthorized(res);
    }

    if (password === undefined || password === null || typeof password !== "string") {
      return unauthorized(res);
    }

    const identifier = normalizeIdentifier(rawIdentifier);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[auth] JWT_SECRET is not configured");
      return res.status(500).json({
        error: "Server configuration error",
        message: "Authentication is not configured.",
      });
    }

    if (await isAdminLoginMatch(identifier, password)) {
      const payload = {
        userId: process.env.ADMIN_ID || identifier,
        role: "admin",
        subjectCodes: [],
        assignedClasses: [],
        name: "Admin",
        email: splitCsvEnv("ADMIN_EMAILS")[0] || null,
        contact: null,
      };
      const token = jwt.sign(payload, secret, { expiresIn: "7d" });
      return res.json({
        token,
        user: payload,
      });
    }

    const facultyDoc = await User.findOne({
      role: "faculty",
      $or: [{ userId: identifier }, { email: identifier }],
    }).select("+passwordHash");

    if (facultyDoc?.passwordHash) {
      const ok = await bcrypt.compare(password, facultyDoc.passwordHash);
      if (!ok) return unauthorized(res);

      const payload = {
        userId: facultyDoc.userId,
        role: "faculty",
        subjectCodes: Array.isArray(facultyDoc.subjectCodes) ? facultyDoc.subjectCodes : [],
        assignedClasses: Array.isArray(facultyDoc.assignedClasses) ? facultyDoc.assignedClasses : [],
        name: facultyDoc.displayLabel || facultyDoc.userId,
        email: facultyDoc.email || null,
        contact: facultyDoc.contact || null,
      };

      const token = jwt.sign(payload, secret, { expiresIn: "7d" });
      return res.json({
        token,
        user: payload,
      });
    }

    // Backward compatibility for static mentor dataset.
    if (password === "teacher123") {
      const mentor = SE_ECS_FACULTY.find(
        (item) => item?.email && String(item.email).trim().toLowerCase() === identifier
      );
      if (mentor) {
        const payload = {
          userId: identifier,
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
      }
    }

    return unauthorized(res);
  } catch (err) {
    next(err);
  }
}
