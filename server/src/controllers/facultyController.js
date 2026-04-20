import bcrypt from "bcryptjs";
import { User } from "../models/User.js";

function normalizeFaculty(user) {
  return {
    userId: user.userId,
    displayLabel: user.displayLabel || "",
    email: user.email || "",
    contact: user.contact || "",
    subjectCodes: Array.isArray(user.subjectCodes) ? user.subjectCodes : [],
    semesterSubjectAssignments: Array.isArray(user.semesterSubjectAssignments)
      ? user.semesterSubjectAssignments
      : [],
    assignedClasses: Array.isArray(user.assignedClasses) ? user.assignedClasses : [],
  };
}

/**
 * GET /api/faculty/me
 */
export async function getMyProfile(req, res, next) {
  try {
    const userId = String(req.user?.userId || "").trim();
    if (!userId) {
      return res.status(401).json({ message: "Invalid authenticated user." });
    }
    const doc = await User.findOne({ userId, role: "faculty" }).lean();
    if (!doc) {
      return res.status(404).json({ message: "Faculty profile not found." });
    }
    return res.json(normalizeFaculty(doc));
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/faculty/me
 * Body: { displayLabel?, email?, contact?, password? }
 */
export async function patchMyProfile(req, res, next) {
  try {
    const userId = String(req.user?.userId || "").trim();
    if (!userId) {
      return res.status(401).json({ message: "Invalid authenticated user." });
    }
    const { displayLabel, email, contact, currentPassword, newPassword, password } = req.body ?? {};

    /** @type {Record<string, unknown>} */
    const update = {};
    if (displayLabel !== undefined) {
      update.displayLabel = String(displayLabel || "").trim();
    }
    if (email !== undefined) {
      update.email = String(email || "").trim().toLowerCase();
    }
    if (contact !== undefined) {
      update.contact = String(contact || "").trim();
    }
    const requestedPassword =
      newPassword !== undefined ? newPassword : password !== undefined ? password : undefined;
    if (requestedPassword !== undefined) {
      if (typeof requestedPassword !== "string" || requestedPassword.length < 6) {
        return res
          .status(400)
          .json({ message: "password must be at least 6 characters when provided." });
      }
      if (typeof currentPassword !== "string" || currentPassword.length === 0) {
        return res
          .status(400)
          .json({ message: "currentPassword is required to change password." });
      }
      const existing = await User.findOne({ userId, role: "faculty" }).select("+passwordHash");
      if (!existing) {
        return res.status(404).json({ message: "Faculty profile not found." });
      }
      const ok = await bcrypt.compare(currentPassword, existing.passwordHash || "");
      if (!ok) {
        return res.status(400).json({ message: "Current password is incorrect." });
      }
      update.passwordHash = await bcrypt.hash(requestedPassword, 10);
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No profile fields provided to update." });
    }

    const doc = await User.findOneAndUpdate(
      { userId, role: "faculty" },
      update,
      { new: true }
    ).lean();
    if (!doc) {
      return res.status(404).json({ message: "Faculty profile not found." });
    }
    return res.json(normalizeFaculty(doc));
  } catch (err) {
    next(err);
  }
}

