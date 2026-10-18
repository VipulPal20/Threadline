# Threadline: Alumni Ask & Resolve Network

A multi-institute (B2B) alumni network that measures whether help actually landed.

A student builds a profile with their résumé and posts an ask. The system scores every eligible alumnus on skills and fit and shows the best three, with the reasons. The student picks one, edits a drafted message and sends it. The alumnus accepts or declines. On accept, both get a conversation page (with optional AI help). The student marks the ask resolved, and the institute's admin sees the whole journey and measured metrics.

Three account types, each with its own sign-in: **Institute admin**, **Alumni**, **Student**. One deployment serves many institutes; everyone only ever sees their own institute.

The original design is in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). The product requirements are in `docs/`.

## What each role can do

| Role | Can do |
| --- | --- |
| **Student** | Create an account with the institute code, finish an onboarding wizard (details, résumé, skills, goals), post up to 3 asks a month, see the top 3 alumni with a match % and reasons, send a drafted request (2 pending per ask at most), chat after acceptance, mark an ask resolved with a rating |
| **Alumnus** | Create an account (the admin approves it), finish onboarding including a **private capacity** (how many students they can help at once), accept or decline requests, see the student's profile and résumé, chat, pause requests |
| **Institute admin** | Register the institute, share the institute code, approve alumni, invite people one by one or by CSV, reset a member's password, see the metrics dashboard (resolution rate, response times, funnel, trends, skills gaps, unmet demand, load fairness), browse every ask with its timeline, export CSV, change settings |

## Quick start

Requires Node.js 22 or newer.

```bash
npm install
copy .env.example .env      # Windows (use cp on macOS/Linux), then set SESSION_SECRET
npm run db:reset            # empties your PostgreSQL database, applies the migrations and loads demo data
npm run dev
```

Open http://localhost:3000.

`npm run db:reset` creates two synthetic institutes (Northbridge Institute of Technology and Lakeshore University), with students, alumni and about 40 asks with realistic outcomes so the admin dashboard has data. Every seeded account uses the local-only password `Demo@12345`:

| Role | Email |
| --- | --- |
| Admin | `admin@northbridge.test` |
| Student | `student1@northbridge.test` |
| Alumnus | `alumni1@northbridge.test` |

Institute codes: `NORTH-2026` and `LAKE-2026`. To start fresh instead, register a new institute at `/register/institute`.

## Configuration

Copy `.env.example` to `.env`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string, for example from Neon (use the direct, non-pooled host). Tests and the browser test use their own `test` and `e2e` schemas in the same database |
| `SESSION_SECRET` | Secret used to hash session and invite tokens. **Required in production.** Generate with `openssl rand -hex 32` |
| `APP_URL` | The public address, used in invite and reset links. If it starts with `https://` cookies are marked Secure and HSTS is sent |
| `GEMINI_API_KEY` | Optional. Without it every AI feature falls back to plain templates and the app works the same |
| `GEMINI_MODEL` | Defaults to `gemini-2.5-flash` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM` | Optional email. Without `SMTP_HOST`, emails are printed in the server log and admins can still copy invite and reset links |
| `LEGAL_CONTACT_EMAIL` | Shown on the Privacy Policy as the contact for data requests |
| `RESUME_DIR` | Where uploaded résumé PDFs are kept. Defaults to `storage/resumes` |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm test` | Unit and service tests (Vitest, in a throwaway `test` schema of your PostgreSQL database) |
| `npm run e2e` | End-to-end happy path in a real browser against the production build |
| `npm run db:reset` | Wipe, recreate and seed the development database |
| `npm run db:migrate` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run admin:reset-password -- <email> "<password>"` | Recover a locked-out institute admin |

End-to-end tests: build first (`npm run build`), then run `E2E_CHANNEL=chrome npm run e2e` to use the Chrome you already have, or `npx playwright install chromium` once and run `npm run e2e`. The test starts its own server on port 3217 with a fresh database.

## How matching works

Matching is a fixed, documented formula. The language model never decides who is shown.

1. **Hard filters.** An alumnus is only considered if they are in the same institute, active, accepting requests, offer that kind of help, have not reached their own limit, have fewer than **4 active conversations**, have not already been asked about this ask, and have not declined this student in the last 30 days. Referral asks with a target company are limited to people at (or able to refer at) that company, and the student is told if nobody qualifies.
2. **Score (0 to 100).** `0.30 skills + 0.15 text + 0.15 role fit + 0.10 student fit + 0.08 affiliation + 0.05 location + 0.05 experience + 0.07 responsiveness + 0.05 headroom`, minus a penalty from 3 active conversations and a small penalty for requests received this week. Weights are in [lib/matching/weights.json](lib/matching/weights.json). Must-have skills count double; skill names are normalised (`js` is `javascript`).
3. **Order.** Highest score first, ties broken by ID, so the same ask always gives the same top three.
4. **Reasons** come from fixed sentence templates filled with real profile data.

## Privacy and security

- **Capacity is private.** An alumnus's limit is readable only by them (and the matching code). It is never in any response to students or admins, and tests assert this.
- **Email and phone numbers are never shown** to other users, even after an alumnus accepts. People talk in the in-app chat.
- **Admins see metadata, not messages.** Message text, decline reasons and résumés are never shown to admins; the audit trail holds no message text.
- **Institute isolation.** Every query is scoped by the institute of the signed-in user, never by anything the browser sends. Cross-institute IDs return "not found".
- **Sign-in.** Role-specific login pages, bcrypt password hashes, server-side sessions in an HttpOnly cookie (only a hash of the token is stored), login throttling, same-origin checks on every change, and rate limits on sign-up, uploads and AI calls.
- **AI.** Emails, phone numbers and links are removed before any text is sent to Gemini; replies are checked before they are shown; every AI result is shown for editing and never sent automatically. Admins can switch AI off per institute.
- **Terms and consent.** Every sign-up form requires agreeing to the Terms and Privacy Policy (`/terms`, `/privacy`); the version and time are stored on the account. The texts are plain-language drafts: have a lawyer review them before launch.
- **Your data.** Settings has a switch for activity emails, a download of everything held about the person (JSON), and account deletion (password required). Deletion closes open requests, conversations and asks, erases the profile, résumé and notifications, blanks message and ask text, and replaces the name and email with placeholders.
- **Headers.** A strict Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff` and a locked-down referrer and permissions policy.

## Running in Docker

```bash
SESSION_SECRET=$(openssl rand -hex 32) docker compose up --build
```

Then open http://localhost:3000 and register your institute. The container applies database migrations on every start. Uploaded résumés live on the `app-data` volume (`/data`), so back that volume up. The database is your PostgreSQL (`DATABASE_URL`).

Behind a TLS proxy, set `APP_URL=https://your.domain` so cookies are marked Secure.

To recover a locked-out admin:

```bash
docker compose exec app node scripts/reset-admin-password.mjs admin@college.edu "NewPassw0rd"
```

## Things to know before a real launch

- **One server.** The login and sign-up rate limiters are in memory, so run a single app instance (or move them to a shared store such as Redis first). The database is PostgreSQL, so it can be shared and backed up by your provider. Résumé PDFs are on local disk: back them up or move them to cloud storage.
- **Email.** With SMTP configured, invites, password resets, new requests, answers, messages and approvals are emailed (never including anyone's email, phone or message text). Without it, links can still be copied. A student's or alumnus's reset link is made by their admin; an admin is recovered with the script above.
- **Run it behind a proxy you control.** Per-address limits read `X-Forwarded-For`, so the proxy must set it (and strip any value a visitor sends). Sign-in is also limited per account, so changing that header does not allow endless password guessing.
- **Next.js 15.5 and React 19.** The app was upgraded from Next.js 14, which carried unfixed security advisories. `npm audit --omit=dev` reports no Next.js advisories (a `postcss` override in `package.json` replaces the copy Next.js bundles). It still lists `tar`, pulled in by the optional `canvas` package, which this app does not load.
- **Gemini is only exercised in fallback mode in this repository's tests**, because no API key is committed. Try it with your own key before relying on it.
- **Résumé reading** works on PDFs that contain text. Scanned PDFs are stored but the member fills in the details by hand.
- **Synthetic data only.** The seed is fake. If you load real people, the DPDP Act, 2023 (India) applies; the consent and contact gating are built with that in mind.

## Project layout

```
app/            pages and API route handlers (student/, alumni/, admin/, api/)
components/     UI pieces (forms, chat, charts, admin tables)
lib/auth/       passwords, sessions, rate limits, guards
lib/matching/   filters, scoring, reasons, weights (pure and tested)
lib/ai/         the only Gemini code, plus template fallbacks and checks
lib/services/   all business rules, one module per area
lib/dto/        what other people are allowed to see of a profile or match
prisma/         schema, migrations, seed
tests/          unit and service tests, and tests/e2e for the browser test
```
