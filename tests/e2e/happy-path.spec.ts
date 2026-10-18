import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * One whole story, through the real screens: an institute signs up, a student and an alumnus join and finish their
 * profiles, the student asks for help and picks the top match, the alumnus accepts, they chat, the student marks the
 * ask resolved, and the admin dashboard reflects it. Along the way it checks that nothing private leaks.
 */

const PASSWORD = "Sup3rsecret";
const ADMIN_EMAIL = "admin@e2e.test";
const STUDENT_EMAIL = "kiran.mehta@e2e.test";
const ALUMNUS_EMAIL = "ravi.menon@gmail.test";
const ASK_TITLE = "Mentor for data analytics";

/** A tiny PDF with real text, so résumé reading has something to find. */
function resumePdf(): Buffer {
  const text = "Kiran Mehta\\nData Analyst Intern at Northstar Labs 2025\\nB.Tech Computer Science Example Institute 2023 - 2027\\nSkills: SQL, Python, Power BI";
  const content = `BT /F1 12 Tf 14 TL 50 740 Td ${text.split("\\n").map((line) => `(${line}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** A fresh browser context. Every goto waits for the network to go idle, so clicks never land before React has hydrated the page. */
/** Open a page and wait until it has loaded and hydrated, so early clicks are not lost. */
async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function actor(browser: Browser, baseURL: string): Promise<Page> {
  const page = await (await browser.newContext({ baseURL })).newPage();
  const goto = page.goto.bind(page);
  page.goto = async (url, options) => {
    const response = await goto(url, options);
    await page.waitForLoadState("networkidle");
    return response;
  };
  return page;
}

async function signIn(page: Page, role: "admin" | "alumni" | "student", email: string) {
  await go(page, `/login/${role}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function addSkills(page: Page, skills: string[]) {
  const input = page.getByLabel("Skills", { exact: true });
  for (const skill of skills) {
    await input.fill(skill);
    await input.press("Enter");
  }
  for (const skill of skills) await expect(page.getByText(skill, { exact: true }).first()).toBeVisible();
}

test("ask, match, request, accept, chat, resolve, measure", async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL!;
  const admin = await actor(browser, baseURL);
  const student = await actor(browser, baseURL);
  const alumnus = await actor(browser, baseURL);
  let code = "";

  await test.step("an institute registers and gets its code", async () => {
    await go(admin, "/register/institute");
    await admin.getByLabel("Institute name").fill("E2E Institute");
    await admin.getByLabel("Student email domains").fill("e2e.test");
    await admin.getByLabel("Your name").fill("Ananya Admin");
    await admin.getByLabel("Your work email").fill(ADMIN_EMAIL);
    await admin.getByLabel("Password").fill(PASSWORD);
    await admin.getByLabel(/I agree to the Terms/).check();
    await admin.getByRole("button", { name: "Create institute" }).click();
    await expect(admin).toHaveURL(/\/admin\/dashboard/);
    const codeText = admin.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/).first();
    await expect(codeText).toBeVisible();
    code = (await codeText.textContent())!.trim();
  });

  await test.step("a student signs up and completes the onboarding wizard with a résumé", async () => {
    await go(student, `/register/student?code=${code}`);
    await student.getByLabel("Full name").fill("Kiran Mehta");
    await student.getByLabel("Institute email").fill(STUDENT_EMAIL);
    await student.getByLabel("Password").fill(PASSWORD);
    await student.getByLabel(/I agree to the Terms/).check();
    await student.getByRole("button", { name: "Create account" }).click();
    await expect(student).toHaveURL(/\/student\/onboarding/);

    await student.getByLabel("Department").fill("Computer Science");
    await student.getByLabel("Degree").fill("B.Tech");
    await student.getByLabel("City").fill("Bengaluru");
    await student.getByLabel("Current year of study").fill("4");
    await student.getByLabel("Graduation year").fill("2027");
    await student.getByRole("button", { name: "Save and continue" }).click();

    await student.locator('input[type="file"]').setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: resumePdf() });
    await expect(student.getByRole("status")).toContainText(/résumé|details/i);
    await student.getByRole("button", { name: "Save and continue" }).click();

    await student.getByRole("button", { name: "Save and continue" }).click(); // education and experience
    await addSkills(student, ["sql", "python", "power bi"]);
    await student.getByRole("button", { name: "Save and continue" }).click();

    const roles = student.getByLabel(/Roles you are aiming for/);
    await roles.fill("Data Analyst");
    await roles.press("Enter");
    await student.getByRole("button", { name: "Save and continue" }).click();
    await student.getByRole("button", { name: "Save and continue" }).click(); // links
    await expect(student.getByText("Everything required is filled in")).toBeVisible();
    await student.getByRole("button", { name: "Finish and go to my dashboard" }).click();
    await expect(student).toHaveURL(/\/student\/dashboard/);
  });

  await test.step("an alumnus signs up, waits for approval, and the admin approves them", async () => {
    await go(alumnus, `/register/alumni?code=${code}`);
    await alumnus.getByLabel("Full name").fill("Ravi Menon");
    await alumnus.getByLabel("Email").fill(ALUMNUS_EMAIL);
    await alumnus.getByLabel("Password").fill(PASSWORD);
    await alumnus.getByLabel(/I agree to the Terms/).check();
    await alumnus.getByRole("button", { name: "Create account" }).click();
    await expect(alumnus).toHaveURL(/\/pending/);

    await go(admin, "/admin/users?status=PENDING_APPROVAL");
    await expect(admin.getByText(ALUMNUS_EMAIL)).toBeVisible();
    await admin.getByRole("button", { name: "Approve" }).click();
    await expect(admin.getByText("No members match this filter.")).toBeVisible();
  });

  await test.step("the alumnus finishes their profile and sets a private capacity", async () => {
    await signIn(alumnus, "alumni", ALUMNUS_EMAIL);
    await expect(alumnus).toHaveURL(/\/alumni\/onboarding/);
    await alumnus.getByLabel("Department studied").fill("Computer Science");
    await alumnus.getByLabel("Graduation year").fill("2018");
    await alumnus.getByRole("button", { name: "Save and continue" }).click();

    await alumnus.getByLabel("Current company").fill("Northstar Labs");
    await alumnus.getByLabel("Job title").fill("Data Analyst");
    await alumnus.getByLabel("Industry / domain").fill("data analytics");
    await alumnus.getByLabel("Years of experience").fill("6");
    await alumnus.getByLabel("City").fill("Bengaluru");
    await alumnus.getByRole("button", { name: "Save and continue" }).click();

    await alumnus.getByRole("button", { name: "Save and continue" }).click(); // experience and education
    await addSkills(alumnus, ["sql", "python", "excel"]);
    await alumnus.getByRole("button", { name: "Save and continue" }).click();

    await alumnus.getByText("Mentorship", { exact: true }).click();
    await alumnus.getByText("Job referral", { exact: true }).click();
    await alumnus.getByRole("button", { name: "Save and continue" }).click();

    await expect(alumnus.getByText("Only you can see this")).toBeVisible();
    await alumnus.getByRole("button", { name: "Save and continue" }).click();
    await alumnus.getByRole("button", { name: "Finish and go to my dashboard" }).click();
    await expect(alumnus).toHaveURL(/\/alumni\/dashboard/);
  });

  let askUrl = "";
  await test.step("the student posts an ask and sees their top match, with no contact details or capacity", async () => {
    await go(student, "/student/asks/new");
    await student.getByLabel(/What kind of help do you need/).selectOption("mentorship");
    await student.getByLabel(/Describe what you need/).fill("I need mentorship on data analytics. I know SQL and Python and want to break in as a data analyst.");
    await student.getByLabel("Title *").fill(ASK_TITLE);
    const skill = student.getByLabel(/Skills you need help with/);
    for (const name of ["sql", "python"]) {
      await skill.fill(name);
      await skill.press("Enter");
    }
    await student.getByLabel("Target role").fill("Data Analyst");
    await student.getByRole("button", { name: /Post ask and see my top 3/ }).click();
    await expect(student).toHaveURL(/\/student\/asks\//);
    askUrl = student.url();

    await expect(student.getByRole("heading", { name: "Your top 1" })).toBeVisible();
    await expect(student.getByText("Ravi Menon")).toBeVisible();
    await expect(student.getByText(/\d+%\s*match/i).first()).toBeVisible();
    const html = await student.content();
    expect(html).not.toContain(ALUMNUS_EMAIL);

    const askId = askUrl.split("/").pop()!;
    const matches = await (await student.request.get(`/api/asks/${askId}/matches`)).text();
    for (const secret of [ALUMNUS_EMAIL, "maxActiveConnections", "acceptingRequests", "passwordHash"]) expect(matches).not.toContain(secret);
  });

  await test.step("the student sends the drafted request", async () => {
    await student.getByRole("button", { name: /Ask Ravi for help/ }).click();
    const message = student.getByLabel("Your message");
    await expect(message).toHaveValue(/Hi Ravi/);
    await student.getByRole("button", { name: "Send request" }).click();
    await expect(student.getByText("Waiting for a reply")).toBeVisible();
    expect(await student.content()).not.toContain(ALUMNUS_EMAIL);
  });

  await test.step("the alumnus reads the request and accepts it", async () => {
    await go(alumnus, "/alumni/requests");
    await alumnus.getByRole("link", { name: new RegExp(ASK_TITLE) }).first().click();
    await expect(alumnus.getByText("Their message")).toBeVisible();
    await expect(alumnus.getByText(STUDENT_EMAIL)).toHaveCount(0);
    await alumnus.getByRole("button", { name: /Accept and start chatting/ }).click();
    await expect(alumnus.getByText("You accepted")).toBeVisible();
    await expect(alumnus.getByText(STUDENT_EMAIL)).toHaveCount(0); // email is never shared
    await alumnus.getByRole("link", { name: /Open the conversation/ }).click();
    await expect(alumnus).toHaveURL(/\/alumni\/conversations\//);
  });

  await test.step("they talk, with AI help falling back to a template", async () => {
    await alumnus.getByLabel("Your message").fill("Happy to help. What are you stuck on right now?");
    await alumnus.getByLabel("Your message").press("Enter");
    await expect(alumnus.getByText("Happy to help. What are you stuck on right now?")).toBeVisible();

    await go(student, "/student/conversations");
    await student.getByRole("link", { name: new RegExp(ASK_TITLE) }).click();
    await expect(student.getByText("Happy to help. What are you stuck on right now?")).toBeVisible();
    await expect(student.getByText(ALUMNUS_EMAIL)).toHaveCount(0); // email is never shared, even after accepting
    await student.getByRole("button", { name: "Suggest a reply" }).click();
    await expect(student.getByRole("status").filter({ hasText: /suggestion/i })).toBeVisible();
    await expect(student.getByLabel("Your message")).not.toHaveValue("");
    await student.getByRole("button", { name: "Send", exact: true }).click();
    await expect(student.getByText("AI-assisted")).toBeVisible();
  });

  await test.step("the student marks the ask resolved", async () => {
    await student.getByRole("button", { name: /Mark as resolved/ }).click();
    await student.getByRole("radio", { name: "5 out of 5" }).click();
    await student.getByRole("button", { name: "Mark resolved", exact: true }).click();
    await expect(student.getByText(/Resolved ✓/)).toBeVisible();
    await expect(student.getByText("This conversation has ended")).toBeVisible();
    await expect(student.getByText(ALUMNUS_EMAIL)).toHaveCount(0); // still hidden
  });

  await test.step("the admin sees it, and nobody can cross the role boundaries", async () => {
    await go(admin, "/admin/dashboard");
    const card = (label: string) => admin.locator(".card", { has: admin.getByText(label, { exact: true }) });
    await expect(card("Resolution rate")).toContainText("100%");
    await expect(card("Average rating")).toContainText("5 / 5");
    await expect(card("Requests accepted")).toContainText("100%");

    await go(admin, "/admin/asks");
    await admin.getByRole("link", { name: ASK_TITLE }).click();
    await expect(admin.getByText("Marked resolved, rated 5/5")).toBeVisible();
    const adminHtml = await admin.content();
    expect(adminHtml).not.toContain("Happy to help");

    await go(student, "/admin/dashboard");
    await expect(student).toHaveURL(/\/student\/dashboard/);
    await go(alumnus, "/student/dashboard");
    await expect(alumnus).toHaveURL(/\/alumni\/dashboard/);
    const unauthenticated = await browser.newContext({ baseURL });
    const response = await unauthenticated.request.get("/api/admin/metrics");
    expect(response.status()).toBe(401);
  });
});
