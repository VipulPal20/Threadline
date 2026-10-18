/**
 * Sets a new password for an institute admin who is locked out (there is no email reset for admins).
 * Run on the server that holds the database:
 *
 *   node scripts/reset-admin-password.mjs admin@college.edu "NewPassw0rd"
 *
 * Plain JavaScript on purpose, so it also works inside the production container.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const [email, password] = process.argv.slice(2);

function problem(value) {
  if (!value || value.length < 8) return "The password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "The password must contain a letter and a number.";
  return null;
}

if (!email || !password) {
  console.error('Usage: node scripts/reset-admin-password.mjs <admin-email> "<new password>"');
  process.exit(1);
}
if (problem(password)) {
  console.error(problem(password));
  process.exit(1);
}

const db = new PrismaClient();
try {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.role !== "ADMIN") {
    console.error("No institute admin has that email.");
    process.exit(1);
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12), status: "ACTIVE" } });
  await db.session.deleteMany({ where: { userId: user.id } });
  await db.auditEvent.create({ data: { instituteId: user.instituteId, actorId: null, kind: "admin.password.reset_by_operator", entity: "user", entityId: user.id } });
  console.log(`Password changed for ${user.email}. They have been signed out everywhere.`);
} finally {
  await db.$disconnect();
}
