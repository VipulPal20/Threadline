import type { Mail } from "./send";

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function appUrl(path = ""): string {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

interface Content {
  subject: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; href: string };
  /** Small print under the button. */
  footnote?: string;
}

/** One simple branded layout for every email. No images, so nothing is blocked or tracked. */
function layout(to: string, content: Content): Mail {
  const text = [
    content.heading,
    "",
    ...content.paragraphs,
    ...(content.action ? ["", `${content.action.label}: ${content.action.href}`] : []),
    ...(content.footnote ? ["", content.footnote] : []),
    "",
    "Threadline · Follow the thread.",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f7f6f0;font-family:Helvetica,Arial,sans-serif;color:#172019">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;padding:32px">
<tr><td style="font-size:20px;font-weight:800">threadline</td></tr>
<tr><td style="padding-top:20px;font-size:26px;font-weight:800;line-height:1.15">${escapeHtml(content.heading)}</td></tr>
${content.paragraphs.map((paragraph) => `<tr><td style="padding-top:14px;font-size:16px;line-height:1.5">${escapeHtml(paragraph)}</td></tr>`).join("")}
${content.action ? `<tr><td style="padding-top:24px"><a href="${escapeHtml(content.action.href)}" style="display:inline-block;background:#b8d830;color:#172019;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:999px">${escapeHtml(content.action.label)}</a></td></tr>` : ""}
${content.footnote ? `<tr><td style="padding-top:20px;font-size:13px;color:#6d796e;line-height:1.5">${escapeHtml(content.footnote)}</td></tr>` : ""}
</table>
<p style="font-size:12px;color:#6d796e">Threadline · Follow the thread.</p>
</td></tr></table></body></html>`;
  return { to, subject: content.subject, text, html };
}

export const emails = {
  invite(to: { email: string; name?: string | null }, input: { instituteName: string; role: "student" | "alumni"; url: string }): Mail {
    return layout(to.email, {
      subject: `${input.instituteName} invited you to Threadline`,
      heading: `You're invited to join ${input.instituteName}`,
      paragraphs: [
        `${to.name ? `Hi ${to.name.split(" ")[0]}, ` : ""}${input.instituteName} uses Threadline to connect ${input.role === "alumni" ? "alumni with students who need a hand" : "students with alumni who can help"}.`,
        "Use the button below to create your account. The link works once.",
      ],
      action: { label: "Accept the invite", href: input.url },
      footnote: "If you weren't expecting this, you can ignore this email.",
    });
  },

  passwordReset(to: { email: string; name: string }, url: string): Mail {
    return layout(to.email, {
      subject: "Reset your Threadline password",
      heading: "Choose a new password",
      paragraphs: [`Hi ${to.name.split(" ")[0]}, your institute admin started a password reset for your account.`, "The link works once and expires in 24 hours."],
      action: { label: "Set a new password", href: url },
      footnote: "If you didn't ask for this, you can ignore this email. Your password stays the same.",
    });
  },

  /** One email per notification worth interrupting someone for. Text never includes anyone's email, phone or message content. */
  notification(to: { email: string; name: string }, input: { subject: string; heading: string; body: string; href: string | null; label: string }): Mail {
    return layout(to.email, {
      subject: input.subject,
      heading: input.heading,
      paragraphs: [`Hi ${to.name.split(" ")[0]},`, input.body],
      action: input.href ? { label: input.label, href: appUrl(input.href) } : undefined,
      footnote: "You can turn these emails off any time in your settings.",
    });
  },
};
