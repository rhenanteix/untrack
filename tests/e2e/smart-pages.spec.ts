import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

const password = "Senha de teste Smart Page! 2026";

async function register(
  page: import("@playwright/test").Page,
  baseURL: string,
) {
  const email = `smart-page-${randomUUID()}@example.com`;
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Pessoa Smart Page");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(`${baseURL}/conta`);
}

test("cria, publica, abre e mede uma Smart Page", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await register(page, baseURL!);
  const slug = `pagina-${randomUUID().slice(0, 8)}`;
  await page.goto("/untrack/smart-pages");
  await page.getByLabel("Nome ou marca").fill("Consultoria Aurora");
  await page.getByLabel("Slug").first().fill(slug);
  await page.getByLabel("Descrição curta").fill("Estratégia e crescimento.");
  await page.getByRole("button", { name: "Criar página" }).click();
  await expect(
    page.getByRole("heading", { name: "Consultoria Aurora" }),
  ).toBeVisible();

  await page.getByLabel("Título").fill("Conheça meu trabalho");
  await page.getByLabel("URL externa").fill("https://example.com/portfolio");
  await page.getByRole("button", { name: "Adicionar link" }).click();
  await expect(page.getByText("Link 1")).toBeVisible();
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Página publicada.")).toBeVisible();

  const pageEvent = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/smart-pages/events") &&
      Boolean(response.request().postData()?.includes("smart_page_view")),
  );
  await page.goto(`/page/${slug}`);
  await expect(
    page.getByRole("heading", { name: "Consultoria Aurora" }),
  ).toBeVisible();
  await pageEvent;

  const clickEvent = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/smart-pages/events") &&
      Boolean(response.request().postData()?.includes("smart_block_clicked")),
  );
  await page
    .getByRole("link", { name: "Conheça meu trabalho" })
    .evaluate((link) => {
      link.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
  await clickEvent;

  const pages = await context.request.get("/api/smart-pages");
  const created = (await pages.json()).items.find(
    (item: { slug: string }) => item.slug === slug,
  );
  await expect
    .poll(async () => {
      const metrics = await context.request.get(
        `/api/smart-pages/${created.id}/analytics?days=30`,
      );
      return (await metrics.json()).clicks;
    })
    .toBe(1);

  const other = await browser.newContext({ baseURL });
  try {
    const email = `other-${randomUUID()}@example.com`;
    const response = await other.request.post("/api/auth/sign-up/email", {
      headers: { origin: baseURL! },
      data: { email, password, name: "Outra pessoa" },
    });
    expect(response.status()).toBe(200);
    expect(
      (await other.request.get(`/api/smart-pages/${created.id}`)).status(),
    ).toBe(404);
  } finally {
    await other.close();
  }
});
