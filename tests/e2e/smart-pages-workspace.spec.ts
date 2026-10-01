import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

async function register(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string,
) {
  const result = await request.post("/api/auth/sign-up/email", {
    headers: {
      origin: baseURL,
      "x-real-ip": `198.18.${Math.floor(Math.random() * 240)}.5`,
    },
    data: {
      name: "Workspace UX",
      email: `smart-ux-${randomUUID()}@example.com`,
      password: "Uma senha forte para teste! 2026",
    },
  });
  expect(result.status(), await result.text()).toBe(200);
}

test("Smart Pages loads, previews profile changes, saves and publishes", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await register(context.request, baseURL!);
  await page.goto("/untrack/smart-pages");
  await expect(
    page.getByRole("heading", { name: "Smart Pages", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Não foi possível carregar o workspace.", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Nome ou marca").fill("Aurora Studio");
  await page
    .locator('form.smart-page-create input[name="slug"]')
    .fill(`aurora-${randomUUID().slice(0, 8)}`);
  await page
    .getByLabel("Descrição curta")
    .fill("Projetos e contato em um só lugar.");
  await page.getByRole("button", { name: "Criar página", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Aurora Studio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Abrir página", exact: true }),
  ).toHaveCount(0);
  await page
    .locator('form.smart-page-profile-form input[name="title"]')
    .fill("Aurora Design");
  await expect(
    page.getByRole("button", { name: "Publicar", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Prévia", exact: true }).click();
  await expect(page.locator(".smart-page-preview strong")).toHaveText(
    "Aurora Design",
  );
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(page.getByText("Perfil salvo.", { exact: true })).toBeVisible();
  await page
    .locator('form.smart-page-add-block input[name="title"]')
    .fill("Conheça nossos projetos");
  await page
    .locator('form.smart-page-add-block input[name="destinationUrl"]')
    .fill("https://example.com/portfolio");
  await page
    .getByRole("button", { name: "Adicionar link", exact: true })
    .click();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(
    page.getByText("Página publicada.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Abrir página", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copiar endereço", exact: true }),
  ).toBeVisible();
  const listing = page.waitForResponse((response) =>
    response.url().includes("/api/smart-pages?page=1&search="),
  );
  await page.getByLabel("Buscar por nome ou endereço").fill("não existe");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await listing;
  await expect(
    page.getByText("Nenhuma página encontrada. Tente outro nome ou endereço."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("smart-pages.png"),
    fullPage: true,
  });
});

test("a foreign workspace cookie has a recoverable selector, without exposing its data", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await register(context.request, baseURL!);
  const other = await browser.newContext();
  await register(other.request, baseURL!);
  const response = await other.request.get(`${baseURL}/api/workspaces`);
  const workspaceId = (await response.json()).activeId;
  await context.addCookies([
    { name: "untrack.workspace", value: workspaceId, url: baseURL! },
  ]);
  await page.goto("/untrack/smart-pages");
  await expect(
    page.getByRole("heading", { name: "Escolha um workspace" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Abrir seletor de workspace" })
    .click();
  const selector = page.getByRole("combobox", {
    name: "Workspace",
    exact: true,
  });
  await expect(selector.locator(`option[value="${workspaceId}"]`)).toHaveCount(
    0,
  );
  const ownMemberships = await (
    await context.request.get("/api/workspaces")
  ).json();
  const ownId = ownMemberships.items[0].workspace.id as string;
  await expect(selector).toBeVisible();
  await selector.selectOption(ownId!);
  await expect(
    page.getByRole("heading", { name: "Smart Pages", exact: true }),
  ).toBeVisible();
  await other.close();
});

test("viewer can read a shared page but cannot edit it in the UI or API", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await register(context.request, baseURL!);
  const own = await (await context.request.get("/api/workspaces")).json();
  const created = await context.request.post("/api/smart-pages", {
    data: {
      title: "Página compartilhada",
      slug: `shared-${randomUUID().slice(0, 8)}`,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const smartPage = await created.json();
  const viewerContext = await browser.newContext();
  const email = `viewer-${randomUUID()}@example.com`;
  await viewerContext.request.post(`${baseURL}/api/auth/sign-up/email`, {
    data: {
      name: "Leitor",
      email,
      password: "Uma senha forte para teste! 2026",
    },
    headers: { origin: baseURL! },
  });
  const otherPage = await viewerContext.request.get(
    `${baseURL}/api/smart-pages/${smartPage.id}`,
  );
  expect(otherPage.status()).toBe(404);
  const membership = await context.request.post("/api/workspace/members", {
    data: { data: { email, role: "viewer" } },
  });
  expect(membership.status(), await membership.text()).toBe(200);
  await viewerContext.request.post(`${baseURL}/api/workspaces`, {
    data: { action: "select", workspaceId: own.activeId },
  });
  const viewerPage = await viewerContext.newPage();
  await viewerPage.goto(`${baseURL}/untrack/smart-pages`);
  await expect(
    viewerPage.getByText("Você tem acesso de leitura.", { exact: false }),
  ).toBeVisible();
  await viewerPage
    .getByRole("button", { name: /Página compartilhada/ })
    .click();
  await expect(
    viewerPage.locator('form.smart-page-profile-form input[name="title"]'),
  ).toBeDisabled();
  await expect(
    viewerPage.getByRole("button", { name: "Publicar", exact: true }),
  ).toBeDisabled();
  expect(
    (
      await viewerContext.request.patch(
        `${baseURL}/api/smart-pages/${smartPage.id}`,
        { data: { title: "Não permitido" } },
      )
    ).status(),
  ).toBe(403);
  await viewerContext.close();
  // Keep the owner page untouched by the viewer's failed mutation.
  const unchanged = await context.request.get(
    `/api/smart-pages/${smartPage.id}`,
  );
  expect((await unchanged.json()).title).toBe("Página compartilhada");
  await page.goto("/untrack/smart-pages");
});
