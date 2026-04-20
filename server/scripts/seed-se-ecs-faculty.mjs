import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { SE_ECS_FACULTY } from "../src/data/seEcsFaculty.js";

function toUserId(name) {
  return (
    "seecs-" +
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32)
  );
}

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("MONGO_URI is required in .env");
  process.exit(1);
}

const plain = process.env.SEED_FACULTY_PASSWORD;
if (!plain || plain.length < 6) {
  console.error("Set SEED_FACULTY_PASSWORD in .env (at least 6 characters).");
  process.exit(1);
}

await mongoose.connect(mongoUri);
const passwordHash = await bcrypt.hash(plain, 10);

for (const row of SE_ECS_FACULTY) {
  const email = row.email ? String(row.email).trim().toLowerCase() : "";
  const displayLabel = row.name;
  const contact = row.contact ? String(row.contact).trim() : "";
  const userId = toUserId(displayLabel);

  const query = email
    ? { role: "faculty", $or: [{ email }, { userId }, { displayLabel }] }
    : { role: "faculty", $or: [{ userId }, { displayLabel }] };

  await User.findOneAndUpdate(
    query,
    {
      $set: {
        role: "faculty",
        userId,
        displayLabel,
        email,
        contact,
        passwordHash,
      },
      $setOnInsert: {
        subjectCodes: [],
        assignedClasses: [],
      },
    },
    { upsert: true, new: true }
  );
}

console.log(`Seeded ${SE_ECS_FACULTY.length} SE-ECS faculty entries.`);
await mongoose.disconnect();
