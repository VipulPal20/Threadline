import nodemailer, { type Transporter } from "nodemailer";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Everything sent while running tests, so tests can check what would have gone out. */
export const testOutbox: Mail[] = [];

let transporter: Transporter | null | undefined;

/** True when SMTP_HOST is set. Without it, mail is printed to the server log instead of being sent. */
export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!emailConfigured()) {
    transporter = null;
    return transporter;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // Port 465 uses TLS straight away; 587 and 25 upgrade with STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

/**
 * Sends one email and never throws: a mail problem must not break the action that triggered it.
 * Returns whether it was handed to the SMTP server.
 */
export async function sendEmail(mail: Mail): Promise<boolean> {
  if (process.env.NODE_ENV === "test") {
    testOutbox.push(mail);
    return true;
  }
  const smtp = getTransporter();
  if (!smtp) {
    console.info(`[email not configured] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    return false;
  }
  try {
    await smtp.sendMail({ from: process.env.SMTP_FROM ?? "Threadline <no-reply@localhost>", to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    return true;
  } catch (error) {
    console.error("[email] could not send", mail.subject, error instanceof Error ? error.message : error);
    return false;
  }
}
