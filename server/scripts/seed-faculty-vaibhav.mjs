/**
 * One-time upsert for sample faculty:
 *   userId: faculty-prof
 *   display: Vaibhav Godbole
 *   email: godbolefragnel@edu.in
 *
 * Usage (from server/):
 *   Set SEED_FACULTY_PASSWORD in .env (min 6 characters), then:
 *   node scripts/seed-faculty-vaibhav.mjs
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";

const USER_ID = "faculty-prof";
const DISPLAY = "Vaibhav Godbole";
const EMAIL = "godbolefragnel@edu.in";

const mongoUri = process.env.MONGO_URI;
const plain = process.env.SEED_FACULTY_PASSWORD;

if (!mongoUri) {
  console.error("MONGO_URI is required in .env");
  process.exit(1);
}
if (!plain || plain.length < 6) {
  console.error("Set SEED_FACULTY_PASSWORD in .env (at least 6 characters).");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(plain, 10);

await mongoose.connect(mongoUri);

await User.findOneAndUpdate(
  { userId: USER_ID },
  {
    $set: {
      displayLabel: DISPLAY,
      email: EMAIL,
      role: "faculty",
      passwordHash,
      subjectCodes: [],
      assignedClasses: [],
    },
  },
  { upsert: true, new: true }
);

console.log(`Upserted faculty: ${USER_ID} (${DISPLAY}) <${EMAIL}>`);
await mongoose.disconnect();
process.exit(0);
