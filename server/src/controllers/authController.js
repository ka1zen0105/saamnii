import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

function unauthorized(res) {
  return res.status(401).json({
    error: "Unauthorized",
    message: "Invalid credentials.",
  });
}

function normalizedUniqueSubjectCodes(user) {
  const out = new Set();
  const top = Array.isArray(user?.subjectCodes) ? user.subjectCodes : [];
  for (const code of top) {
    const c = String(code ?? "").trim();
    if (c) out.add(c);
  }
  const semRows = Array.isArray(user?.semesterSubjectAssignments)
    ? user.semesterSubjectAssignments
    : [];
  for (const row of semRows) {
    const list = Array.isArray(row?.subjectCodes) ? row.subjectCodes : [];
    for (const code of list) {
      const c = String(code ?? "").trim();
      if (c) out.add(c);
    }
  }
  return Array.from(out);
}

/**
 * POST /api/auth/login
 * Body: { userId, role: "admin" | "faculty", password }
 */
export async function login(req, res, next) {
  try {
    const { userId, role, password } = req.body ?? {};

    if (
      userId === undefined ||
      userId === null ||
      typeof userId !== "string" ||
      !userId.trim()
    ) {
      return unauthorized(res);
    }

    if (
      role === undefined ||
      role === null ||
      typeof role !== "string" ||
      !role.trim()
    ) {
      return unauthorized(res);
    }

    if (password === undefined || password === null || typeof password !== "string") {
      return unauthorized(res);
    }

    const uid = userId.trim();
    const roleNorm = role.trim().toLowerCase();

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[auth] JWT_SECRET is not configured");
      return res.status(500).json({
        error: "Server configuration error",
        message: "Authentication is not configured.",
      });
    }

    if (roleNorm === "admin") {
      const adminId = process.env.ADMIN_ID;
      if (!adminId || uid !== String(adminId).trim()) {
        return unauthorized(res);
      }

      const adminPassHash = process.env.ADMIN_PASSWORD_HASH;
      const adminPassPlain = process.env.ADMIN_PASSWORD;

      let passwordOk = false;
      if (adminPassHash && String(adminPassHash).trim()) {
        passwordOk = await bcrypt.compare(password, String(adminPassHash).trim());
      } else if (adminPassPlain != null && String(adminPassPlain).length > 0) {
        passwordOk = password === String(adminPassPlain);
      } else {
        return res.status(500).json({
          message:
            "Admin password not configured. Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH in .env.",
        });
      }

      if (!passwordOk) {
        return unauthorized(res);
      }

      const payload = {
        userId: uid,
        role: "admin",
        subjectCodes: [],
        assignedClasses: [],
      };

      const token = jwt.sign(payload, secret, { expiresIn: "7d" });
      return res.json({ token });
    }

    if (roleNorm === "faculty") {
      const user = await User.findOne({ userId: uid, role: "faculty" }).select(
        "+passwordHash"
      );

      if (!user?.passwordHash) {
        return unauthorized(res);
      }

      const passwordOk = await bcrypt.compare(password, user.passwordHash);
      if (!passwordOk) {
        return unauthorized(res);
      }

      const payload = {
        userId: user.userId,
        role: "faculty",
        subjectCodes: normalizedUniqueSubjectCodes(user),
        assignedClasses: Array.isArray(user.assignedClasses)
          ? user.assignedClasses
          : [],
      };

      const token = jwt.sign(payload, secret, { expiresIn: "7d" });

      return res.json({
        token,
        user: payload,
      });
    }

    return unauthorized(res);
  } catch (err) {
    next(err);
  }
}
