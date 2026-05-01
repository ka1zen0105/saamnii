import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { Subject } from "../src/models/Subject.js";
import { Settings } from "../src/models/Settings.js";
import { SE_ECS_FACULTY } from "../src/data/seEcsFaculty.js";
import { SEMESTER_SUBJECT_CATALOG } from "../src/data/semesterSubjectCatalog.js";

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) { console.error("MONGO_URI missing"); process.exit(1); }
const plain = process.env.SEED_FACULTY_PASSWORD;
if (!plain || plain.length < 6) { console.error("SEED_FACULTY_PASSWORD missing/too short"); process.exit(1); }

function toUserId(name) {
  return "seecs-" + String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

await mongoose.connect(mongoUri);
console.log("Connected.\n");
const passwordHash = await bcrypt.hash(plain, 10);

// 1. Seed all faculty
console.log("Seeding faculty...");
for (const row of SE_ECS_FACULTY) {
  const displayLabel = String(row.name || "").trim();
  const email = row.email ? String(row.email).trim().toLowerCase() : "";
  const contact = String(row.contact || "").trim();
  const userId = toUserId(displayLabel);
  const query = email
    ? { role: "faculty", $or: [{ email }, { userId }, { displayLabel }] }
    : { role: "faculty", $or: [{ userId }, { displayLabel }] };
  await User.findOneAndUpdate(query, {
    $set: { role: "faculty", userId, displayLabel, email, contact, passwordHash },
    $setOnInsert: { subjectCodes: [], semesterSubjectAssignments: [], assignedClasses: [] },
  }, { upsert: true, new: true });
  console.log(`  ✓ ${displayLabel} → ${userId}`);
}

// Keep the old faculty-prof alias working
await User.findOneAndUpdate(
  { userId: "faculty-prof" },
  { $set: { role: "faculty", displayLabel: "Vaibhav Godbole", email: "godbole@fragnel.edu.in", passwordHash },
    $setOnInsert: { subjectCodes: [], semesterSubjectAssignments: [], assignedClasses: [] } },
  { upsert: true, new: true }
);
console.log("  ✓ faculty-prof alias kept\n");

// 2. Seed Subject collection
console.log("Seeding subjects...");
const ops = [];
for (const semRow of SEMESTER_SUBJECT_CATALOG) {
  const semester = Number(semRow.semester);
  for (const sub of (semRow.subjects || [])) {
    const subject_code = String(sub.code || "").trim().toUpperCase();
    const subject_name = String(sub.name || "").trim();
    if (!subject_code || !subject_name) continue;
    ops.push({ updateOne: { filter: { semester, subject_code }, update: { $set: { semester, subject_code, subject_name } }, upsert: true } });
  }
}
if (ops.length) await Subject.bulkWrite(ops, { ordered: false });
console.log(`  ✓ ${ops.length} subjects across ${SEMESTER_SUBJECT_CATALOG.length} semesters\n`);

// 3. Save catalog into Settings so admin UI picks it up immediately
const catalogPayload = SEMESTER_SUBJECT_CATALOG.map(s => ({
  semester: Number(s.semester),
  subjects: (s.subjects || []).map(x => ({ code: String(x.code||"").trim(), name: String(x.name||"").trim() })),
}));
await Settings.findByIdAndUpdate("app", { semesterSubjectCatalog: catalogPayload }, { upsert: true });
console.log("  ✓ Catalog saved to Settings\n");

console.log("Done. Run the server and log in with any faculty account.");
await mongoose.disconnect();
process.exit(0);
