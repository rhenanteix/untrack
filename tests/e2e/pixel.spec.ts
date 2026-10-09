import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const sdk = readFileSync("public/pixel/v1.js", "utf8");
const external = "http://localhost:3201";
const sdkHost = "http://localhost:3100";
async function fixture(page: Page, site = "test-site", query = "") {
  await page.route(`${external}/**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body><input aria-label="email" value="secret@example.com"><input type="password" value="secret"><a href="#next">Private link text</a><button data-linkor-goal="quote">Orçamento privado</button><script async src="${sdkHost}/pixel/v1.js" data-site-id="${site}" referrerpolicy="no-referrer"></script></body></html>`,
    }),
  );
  await page.route(`${sdkHost}/pixel/v1.js`, (route) =>
    route.fulfill({ contentType: "application/javascript", body: sdk }),
  );
  await page.goto(external + "/" + query);
  await page.waitForFunction(() =>
    Boolean((window as unknown as { LinkOr: unknown }).LinkOr),
  );
}
async function consent(page: Page, choice = "granted") {
  await page.evaluate(
    (value) =>
      window.dispatchEvent(
        new CustomEvent("linkor:consent", { detail: { analytics: value } }),
      ),
    choice,
  );
}

test("SDK consent, no PII/storage, SPA and duplicate installation", async ({
  page,
}) => {
  const payloads: Record<string, unknown>[] = [];
  await page.route(`${sdkHost}/api/connect/public/**`, async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: "{}",
      headers: { "Access-Control-Allow-Origin": external },
    });
  });
  await fixture(page);
  await page.getByRole("button").click();
  await consent(page, "denied");
  expect(payloads).toHaveLength(0);
  await consent(page);
  await expect.poll(() => payloads.length).toBe(1);
  await page.getByRole("button").click();
  await expect.poll(() => payloads.length).toBe(2);
  await page.evaluate(() => {
    history.pushState({}, "", "/spa?email=secret@example.com");
    history.replaceState({}, "", "/spa?email=secret@example.com");
  });
  await expect.poll(() => payloads.length).toBe(3);
  await page
    .addScriptTag({ url: `${sdkHost}/pixel/v1.js`, type: "text/javascript" })
    .then(async (element) => {
      await element.dispose();
    });
  // A real second installation has the same public site ID.
  await page.evaluate((host) => {
    const s = document.createElement("script");
    s.src = host + "/pixel/v1.js";
    s.dataset.siteId = "test-site";
    document.head.appendChild(s);
  }, sdkHost);
  await expect.poll(() => payloads.length).toBe(4);
  expect(payloads.map((p) => p.event_name)).toEqual([
    "page_view",
    "cta_click",
    "page_view",
    "pixel_diagnostic",
  ]);
  expect(JSON.stringify(payloads)).not.toMatch(
    /secret|Private|Orçamento|email|password|spa/,
  );
  expect(
    await page.evaluate(() => [
      document.cookie,
      localStorage.length,
      sessionStorage.length,
    ]),
  ).toEqual(["", 0, 0]);
  await consent(page, "denied");
  await page.getByRole("button").click();
  await page.waitForTimeout(150);
  expect(payloads).toHaveLength(4);
});

test("network retry keeps event ID, is bounded, and stops on withdrawal", async ({
  page,
}) => {
  const ids: string[] = [];
  await page.route(`${sdkHost}/api/connect/public/**`, async (route) => {
    ids.push(route.request().postDataJSON().event_id);
    await route.fulfill({
      status: 503,
      body: "{}",
      headers: { "Access-Control-Allow-Origin": external },
    });
  });
  await fixture(page);
  await consent(page);
  await expect.poll(() => ids.length, { timeout: 8000 }).toBe(3);
  expect(new Set(ids).size).toBe(1);
  await page.waitForTimeout(2200);
  expect(ids).toHaveLength(3);
  await page.getByRole("button").click();
  await expect.poll(() => ids.length).toBe(4);
  await consent(page, "denied");
  await page.waitForTimeout(2200);
  expect(ids).toHaveLength(4);
});

test("blockers fail quietly; GPC overrides granted consent", async ({
  page,
}) => {
  let attempts = 0;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(`${sdkHost}/api/connect/public/**`, async (route) => {
    attempts++;
    await route.abort("blockedbyclient");
  });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "globalPrivacyControl", {
      value: true,
      configurable: true,
    }),
  );
  await fixture(page);
  await consent(page);
  await page.getByRole("button").click();
  expect(attempts).toBe(0);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "globalPrivacyControl", { value: false }),
  );
  await consent(page);
  await expect.poll(() => attempts, { timeout: 8000 }).toBe(3);
  expect(errors).toEqual([]);
});

test("real setup → external SDK → PostgreSQL receipt → panel confirmation", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  const signup = await context.request.post(
    `${baseURL}/api/auth/sign-up/email`,
    {
      headers: { origin: baseURL! },
      data: {
        name: "Pixel verification",
        email: `pixel-${randomUUID()}@example.com`,
        password: "Pixel-test-only-12345!",
      },
    },
  );
  expect(signup.ok()).toBeTruthy();
  await page.goto("/untrack/pixel");
  await page
    .getByPlaceholder(
      "https://suaempresa.com.br\nhttps://www.suaempresa.com.br",
    )
    .fill(external);
  await page
    .getByRole("button", { name: "Cadastrar site", exact: true })
    .click();
  await expect(
    page.getByLabel("Código de instalação", { exact: true }),
  ).toHaveValue(/data-site-id=/);
  const snippet = await page
    .getByLabel("Código de instalação", { exact: true })
    .inputValue();
  const site = snippet.match(/data-site-id="([^"]+)"/)![1];
  await page.getByRole("button", { name: "Preparar evento de teste" }).click();
  const link = await page
    .getByRole("link", { name: "Abrir meu site para testar" })
    .getAttribute("href");
  const visitor = await context.newPage();
  await fixture(visitor, site, new URL(link!).search);
  // No mocked ingestion in this test: both CORS and the receipt are real.
  await consent(visitor);
  await expect(page.getByText(/Recebimento confirmado em/)).toBeVisible({
    timeout: 25000,
  });
  await page.screenshot({
    path: testInfo.outputPath("pixel-receipt.png"),
    fullPage: true,
  });
  await visitor.close();
});
