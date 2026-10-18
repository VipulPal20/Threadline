const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_LIKE = /(?:https?:\/\/|www\.)\S+/gi;
// Also catches the common Indian 5+5 grouping ("98765 43210") that has no country code.
const PHONE = /(?:\+\d[\d\s-]{8,16}\d|\b\d{10,12}\b|\b\d{5}[\s-]\d{5}\b|\b\d{3,5}[\s-]\d{3,5}[\s-]\d{3,5}\b)/g;

/** Removes emails, links and phone numbers before any text leaves the server for a language model. */
export function redactContacts(text: string): string {
  return text.replace(EMAIL, "[email removed]").replace(URL_LIKE, "[link removed]").replace(PHONE, "[phone removed]");
}

export function containsContactDetails(text: string): boolean {
  return [EMAIL, URL_LIKE, PHONE].some((pattern) => {
    pattern.lastIndex = 0;
    const found = pattern.test(text);
    pattern.lastIndex = 0;
    return found;
  });
}
