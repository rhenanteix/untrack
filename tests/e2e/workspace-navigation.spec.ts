import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { grantTestPremium } from "../helpers/premium";

async function account(request: APIRequestContext, baseURL: string) {
  const response = await request.post(`${baseURL}/api/auth/sign-up/email`, {
    headers: {
      origin: baseURL,
      "x-real-ip": `198.18.${Math.floor(Math.random() * 240)}.12`,
    },
    data: {
      name: "Biblioteca UX",
      email: `navigation-${randomUUID()}@example.com`,
      password: "Uma senha forte! 2026 biblioteca",
    },
  });
  expect(response.status(), await response.text()).toBe(200);
  const workspace = await (
    await request.get(`${baseURL}/api/workspaces`)
  ).json();
  await grantTestPremium(workspace.activeId);
}
async function nav(page: Page, label: string) {
  const toggle = page.getByRole("button", { name: "Menu do workspace" });
  if (await toggle.isVisible()) await toggle.click();
  await page
    .locator(".workspace-nav-link")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .click();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

test("shared shell, real libraries, filters, bulk isolation and recoverable errors", async ({
  page,
  context,
  browser,
  baseURL,
}, info) => {
  await account(context.request, baseURL!);
  const create = await context.request.post("/api/short-links", {
    data: {
      url: "https://example.com/portfolio?utm_source=linkedin",
      title: "Portfolio real",
    },
  });
  expect(create.status(), await create.text()).toBe(201);
  const own = await create.json();
  await context.request.post("/api/campaigns", {
    data: { name: "Campanha persistida" },
  });
  let workspaceRequests = 0;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/workspaces") workspaceRequests++;
  });
  await page.goto("/conta");
  await expect(page.locator(".workspace-nav-link").first()).toBeAttached();
  await expect(
    page.getByRole("heading", { name: /Boa (dia|tarde|noite), Biblioteca/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Links" })).toBeVisible();
  await expect(page.getByRole("link", { name: "UTM Builder" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Smart Pages" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Analytics" })).toBeVisible();
  await expect(page.getByText("Em breve", { exact: true })).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("dashboard.png"),
    fullPage: true,
  });
  const baseline = workspaceRequests;
  await nav(page, "Links");
  await expect(
    page.getByRole("link", { name: "Portfolio real", exact: true }),
  ).toBeVisible();
  expect(workspaceRequests).toBe(baseline);
  await page.getByLabel("Buscar", { exact: true }).fill("Portfolio");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page).toHaveURL(/search=Portfolio/);
  await page.getByRole("link", { name: "Portfolio real", exact: true }).click();
  await page.getByRole("link", { name: /biblioteca de links/i }).click();
  await expect(page.getByLabel("Buscar", { exact: true })).toHaveValue(
    "Portfolio",
  );
  await page
    .getByRole("checkbox", { name: "Selecionar Portfolio real", exact: true })
    .check();
  await page.getByRole("button", { name: "Desativar", exact: true }).click();
  await expect(page.locator(".library-status")).toHaveText("Desativado");
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("links-library.png"),
    fullPage: true,
  });
  const other = await browser.newContext();
  try {
    await account(other.request, baseURL!);
    const foreignResponse = await other.request.post(
      `${baseURL}/api/short-links`,
      { data: { url: "https://example.org", title: "Outro workspace" } },
    );
    const foreign = await foreignResponse.json();
    const rejected = await context.request.patch("/api/short-links/bulk", {
      data: { ids: [own.id, foreign.id], isActive: true },
    });
    expect(rejected.status(), await rejected.text()).toBe(404);
    const unchanged = await (
      await context.request.get("/api/short-links?status=inactive")
    ).json();
    expect(unchanged.items.map((row: { id: string }) => row.id)).toContain(
      own.id,
    );
    expect(unchanged.items.map((row: { id: string }) => row.id)).not.toContain(
      foreign.id,
    );
  } finally {
    await other.close();
  }
  await page.route("**/api/campaigns?*", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Banco temporariamente indisponível." },
    }),
  );
  await nav(page, "Campanhas");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar",
  );
  await expect(page.getByText("Sua biblioteca começa aqui")).toHaveCount(0);
  await page.unroute("**/api/campaigns?*");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("link", { name: "Campanha persistida", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("campaigns-library.png"),
    fullPage: true,
  });
});

test("editor tabs, mobile preview, automatic metrics and local errors", async ({
  page,
  context,
  baseURL,
}, info) => {
  await account(context.request, baseURL!);
  const created = await context.request.post("/api/smart-pages", {
    data: {
      title: "Cartão profissional",
      slug: `ux-${randomUUID().slice(0, 8)}`,
    },
  });
  const record = await created.json();
  await page.goto(`/untrack/smart-pages?edit=${record.id}`);
  await expect(
    page.getByRole("tab", { name: "Perfil", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Buscar por nome ou endereço")).toBeHidden();
  await page
    .locator('.smart-page-profile-form input[name="title"]')
    .fill("Meu cartão atualizado");
  const preview = page.getByRole("tab", { name: "Prévia", exact: true });
  if (await preview.isVisible()) {
    await preview.click();
    await expect(page.locator(".smart-page-profile-form")).toBeHidden();
  }
  await expect(page.locator(".smart-page-preview strong")).toHaveText(
    "Meu cartão atualizado",
  );
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("editor-preview.png"),
    fullPage: true,
  });
  if (await preview.isVisible())
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(page.getByText("Perfil salvo.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Perfil", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Aparência", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /Usar modelo/ })).toHaveCount(
    21,
  );
  await expect(
    page.getByRole("combobox", { name: "Alinhamento", exact: true }),
  ).toBeHidden();
  await page.screenshot({
    path: info.outputPath("template-gallery.png"),
    fullPage: true,
  });
  const autoLoad = page.waitForResponse((res) =>
    res.url().includes(`/api/smart-pages/${record.id}/analytics`),
  );
  await page.getByRole("tab", { name: "Resultados", exact: true }).click();
  await autoLoad;
  await expect(page.locator(".smart-page-stats strong").first()).toHaveText(
    "0",
  );
  await expect(page.getByText(/Última atualização:/)).toBeVisible();
  await page.route("**/analytics?*", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Resultados indisponíveis no momento." },
    }),
  );
  await page.getByRole("button", { name: "Atualizar métricas" }).click();
  await expect(page.locator(".smart-page-metrics [role=alert]")).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Perfil", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".smart-page-stats")).toHaveCount(0);
  await page.unroute("**/analytics?*");
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(page.locator(".smart-page-stats strong").first()).toHaveText(
    "0",
  );
  await page
    .getByRole("combobox", { name: "Período", exact: true })
    .selectOption("7");
  await expect(
    page.getByRole("button", { name: "Atualizar métricas" }),
  ).toBeEnabled();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("page-results.png"),
    fullPage: true,
  });
  const toggle = page.getByRole("button", { name: "Menu do workspace" });
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
  }
});
