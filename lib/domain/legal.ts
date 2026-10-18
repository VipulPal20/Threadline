/** Bump when the Terms or Privacy Policy change in a way people must agree to again. */
export const TERMS_VERSION = "2026-10-18";

/** What a new account records when someone agrees to the Terms and Privacy Policy. */
export function termsAcceptance() {
  return { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION };
}
