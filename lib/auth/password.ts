import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "qwertyuiop",
  "iloveyou1",
  "admin1234",
  "welcome123",
  "letmein123",
]);

// Compared against when an email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH).then((matches) => (hash ? matches : false));
}

/** Returns a human-readable problem with the password, or null when it is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password must be 128 characters or fewer.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password must contain at least one letter and one number.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "That password is too common.";
  return null;
}
