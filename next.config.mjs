const isDev = process.env.NODE_ENV !== "production";
const https = (process.env.APP_URL ?? "").startsWith("https://");

// Next.js needs inline scripts and styles for its own bootstrap, so 'unsafe-inline' stays for those two.
// Everything else is locked to this origin; nothing on the site loads from a third party.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Pages get the strict policy. Resume downloads are PDFs, and a policy with object-src 'none' can stop the
      // browser's built-in PDF viewer from opening them, so that one route is left out (it still gets nosniff etc.).
      { source: "/((?!api/resumes/).*)", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] },
    ];
  },
};

export default nextConfig;
