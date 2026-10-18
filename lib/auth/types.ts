import type { Role, UserStatus } from "../domain/constants";

/** The authenticated user as seen by guards and services. Never includes the password hash. */
export interface SessionUser {
  id: string;
  instituteId: string;
  role: Role;
  status: UserStatus;
  name: string;
  email: string;
  onboardingComplete: boolean;
}

export function homePathFor(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin/dashboard";
    case "ALUMNI":
      return "/alumni/dashboard";
    case "STUDENT":
      return "/student/dashboard";
  }
}

/** URL segment used by the login and register pages. */
export type RoleSlug = "admin" | "alumni" | "student";

export const ROLE_BY_SLUG: Record<RoleSlug, Role> = {
  admin: "ADMIN",
  alumni: "ALUMNI",
  student: "STUDENT",
};

export function parseRoleSlug(value: string): RoleSlug | null {
  return value === "admin" || value === "alumni" || value === "student" ? value : null;
}
