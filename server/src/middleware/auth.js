import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export function getBearerToken(req) {
  const raw = req.headers.authorization;
  if (!raw || typeof raw !== "string") return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function mergedSubjectCodes(doc) {
  const flat = Array.isArray(doc?.subjectCodes) ? doc.subjectCodes : [];
  const bySem = Array.isArray(doc?.semesterSubjectAssignments)
    ? doc.semesterSubjectAssignments
    : [];
  const out = [];
  const seen = new Set();
  for (const code of [
    ...flat,
    ...bySem.flatMap((row) =>
      Array.isArray(row?.subjectCodes) ? row.subjectCodes : []
    ),
  ]) {
    const c = String(code ?? "").trim();
    if (!c) continue;
    const key = c.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Verifies Bearer JWT and attaches `req.user`:
 * `{ userId, role, subjectCodes, assignedClasses }`.
 * Faculty subject/class scope is refreshed from MongoDB so admin
 * Faculty Access changes apply without forcing a re-login.
 */
export async function verifyToken(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("[auth] JWT_SECRET is not configured");
    return res.status(500).json({
      error: "Server configuration error",
      message: "Authentication is not configured.",
    });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header (expected Bearer token).",
    });
  }

  try {
    const payload = jwt.verify(token, secret);

    const userId = payload.userId ?? payload.sub;
    if (!userId || typeof userId !== "string") {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Token does not contain a valid user id.",
      });
    }

    const role = payload.role;
    if (role !== "admin" && role !== "faculty") {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Token does not contain a valid role.",
      });
    }

    const trimmedId = userId.trim();
    req.user = {
      userId: trimmedId,
      role,
      subjectCodes: Array.isArray(payload.subjectCodes) ? payload.subjectCodes : [],
      assignedClasses: Array.isArray(payload.assignedClasses)
        ? payload.assignedClasses
        : [],
    };

    if (role === "faculty") {
      const idLower = trimmedId.toLowerCase();
      const doc = await User.findOne({
        role: "faculty",
        $or: [
          { userId: trimmedId },
          { email: idLower },
          { email: trimmedId },
        ],
      })
        .select("subjectCodes semesterSubjectAssignments assignedClasses")
        .lean();

      if (doc) {
        req.user.subjectCodes = mergedSubjectCodes(doc);
        req.user.assignedClasses = Array.isArray(doc.assignedClasses)
          ? doc.assignedClasses
          : [];
      }
    }

    next();
  } catch (err) {
    if (err?.name === "TokenExpiredError" || err?.name === "JsonWebTokenError") {
      const msg =
        err?.name === "TokenExpiredError"
          ? "Token expired."
          : "Invalid or malformed token.";
      return res.status(401).json({
        error: "Unauthorized",
        message: msg,
      });
    }
    next(err);
  }
}

/** Must run after `verifyToken`. */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      error: "Forbidden",
      message: "This action requires admin privileges.",
    });
  }
  next();
}

/** Must run after `verifyToken`. */
export function requireFaculty(req, res, next) {
  if (req.user?.role !== "faculty") {
    return res.status(403).json({
      error: "Forbidden",
      message: "This action requires faculty privileges.",
    });
  }
  next();
}

/** Backwards compatibility — same as `verifyToken`. */
export const requireAuth = verifyToken;
