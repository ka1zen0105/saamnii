import jwt from "jsonwebtoken";

export function getBearerToken(req) {
  const raw = req.headers.authorization;
  if (!raw || typeof raw !== "string") return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Verifies Bearer JWT and attaches `req.user`:
 * `{ userId, role, subjectCodes, assignedClasses }`.
 */
export function verifyToken(req, res, next) {
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

    req.user = {
      userId: userId.trim(),
      role,
      subjectCodes: Array.isArray(payload.subjectCodes) ? payload.subjectCodes : [],
      assignedClasses: Array.isArray(payload.assignedClasses)
        ? payload.assignedClasses
        : [],
    };

    next();
  } catch (err) {
    const msg =
      err?.name === "TokenExpiredError"
        ? "Token expired."
        : "Invalid or malformed token.";
    return res.status(401).json({
      error: "Unauthorized",
      message: msg,
    });
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
