import { db } from "../lib/db";
import { resetRateLimits } from "../lib/auth/rate-limit";
import type { SessionUser } from "../lib/auth/types";
import { registerInstitute } from "../lib/services/institutes";
import { registerMember } from "../lib/services/users";

/** Empties every table, children first. */
export async function resetDb() {
  await db.auditEvent.deleteMany();
  await db.notification.deleteMany();
  await db.message.deleteMany();
  await db.conversation.deleteMany();
  await db.introRequest.deleteMany();
  await db.matchSnapshot.deleteMany();
  await db.askSkill.deleteMany();
  await db.ask.deleteMany();
  await db.userSkill.deleteMany();
  await db.resume.deleteMany();
  await db.experience.deleteMany();
  await db.education.deleteMany();
  await db.studentProfile.deleteMany();
  await db.alumniProfile.deleteMany();
  await db.passwordReset.deleteMany();
  await db.invite.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.skill.deleteMany();
  await db.institute.deleteMany();
  resetRateLimits();
}

export const PASSWORD = "Sup3rsecret";

export async function makeInstitute(name: string, domain: string, adminEmail: string) {
  const { institute, admin } = await registerInstitute({
    instituteName: name,
    name: `${name} Admin`,
    email: adminEmail,
    password: PASSWORD,
    domains: [domain],
  });
  const sessionUser: SessionUser = {
    id: admin.id,
    instituteId: institute.id,
    role: "ADMIN",
    status: "ACTIVE",
    name: admin.name,
    email: admin.email,
    onboardingComplete: true,
  };
  return { institute, admin: sessionUser };
}

export async function makeMember(code: string, role: "student" | "alumni", email: string) {
  return registerMember({ code, role, name: "Test Person", email, password: PASSWORD });
}
