import { grantTestPremium } from "../helpers/premium";
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
  const workspace = await (await page.request.get("/api/workspaces")).json();
  await grantTestPremium(workspace.activeId);
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
  await page.getByRole("button", { name: /Nova página/ }).click();
  await page.getByLabel("Nome ou marca").fill("Consultoria Aurora");
  await page.locator('.smart-page-create input[name="slug"]').fill(slug);
  await page.getByLabel("Descrição curta").fill("Estratégia e crescimento.");
  await page.getByRole("button", { name: "Criar página" }).click();
  await expect(
    page.getByRole("heading", { name: "Consultoria Aurora" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Links", exact: true }).click();
  await page.getByLabel("Título").fill("Conheça meu trabalho");
  await page
    .locator('input[name="destinationUrl"]')
    .fill("https://example.com/portfolio");
  await page.getByRole("button", { name: "Adicionar link" }).click();
  await expect(
    page.locator('.smart-page-block-list input[name="title"]'),
  ).toHaveValue("Conheça meu trabalho");
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

test("publica blocos ricos e mantém o layout responsivo", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await register(page, baseURL!);
  const slug = `blocos-${randomUUID().slice(0, 8)}`;
  await page.goto("/untrack/smart-pages");
  await page.getByRole("button", { name: /Nova página/ }).click();
  await page.getByLabel("Nome ou marca").fill("Ateliê de Conteúdo");
  await page.locator('.smart-page-create input[name="slug"]').fill(slug);
  await page.getByRole("button", { name: "Criar página" }).click();

  await page.getByRole("tab", { name: "Links", exact: true }).click();
  await page.getByRole("button", { name: /Adicionar/ }).click();
  const picker = page.getByRole("dialog", { name: "Adicionar conteúdo" });
  await picker.getByPlaceholder("Cole um link ou pesquise...").fill("Título");
  await picker.getByRole("button", { name: /Título Destaque/ }).click();
  await picker.getByLabel("Título").fill("Agenda aberta");
  await picker.getByRole("button", { name: "Adicionar título" }).click();
  await expect(page.getByText("Conteúdo adicionado à página.")).toBeVisible();

  const pages = await context.request.get("/api/smart-pages");
  const created = (await pages.json()).items.find(
    (item: { slug: string }) => item.slug === slug,
  );
  expect(created).toBeTruthy();
  const addBlock = async (type: string, settings: Record<string, string>) => {
    const response = await context.request.post(
      `/api/smart-pages/${created.id}/blocks`,
      {
        headers: { origin: baseURL! },
        data: { type, settings },
      },
    );
    expect(await response.text()).toBeTruthy();
    expect(response.status()).toBe(201);
  };
  await addBlock("text", {
    content: "Conteúdo novo toda semana.",
    alignment: "left",
  });
  await addBlock("image", {
    imageUrl: "https://images.example.com/capa.webp",
    alt: "Capa do boletim",
  });
  await addBlock("video", {
    url: "https://youtu.be/dQw4w9WgXcQ",
    title: "Vídeo de boas-vindas",
  });
  await addBlock("spotify", {
    url: "https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8",
    title: "Playlist da semana",
  });
  await addBlock("qr", {
    destinationUrl: "https://example.com/agenda",
    title: "Escaneie para agendar",
  });
  await addBlock("whatsapp", {
    number: "+55 11 99999-9999",
    label: "Falar no WhatsApp",
    message: "Olá! Quero saber mais.",
  });
  await addBlock("event", {
    title: "Aula ao vivo",
    date: "12 de outubro, 19h",
    destinationUrl: "https://example.com/aula",
  });
  const published = await context.request.post(
    `/api/smart-pages/${created.id}/publish`,
    { headers: { origin: baseURL! }, data: { published: true } },
  );
  expect(published.status()).toBe(200);

  await page.goto(`/page/${slug}`);
  await expect(
    page.getByRole("heading", { name: "Ateliê de Conteúdo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Agenda aberta" }),
  ).toBeVisible();
  await expect(page.getByText("Conteúdo novo toda semana.")).toBeVisible();
  await expect(page.locator(".richEmbed")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "Falar no WhatsApp" }),
  ).toHaveAttribute(
    "href",
    "https://wa.me/5511999999999?text=Ol%C3%A1!%20Quero%20saber%20mais.",
  );
  await expect(
    page.getByRole("img", { name: "QR Code: Escaneie para agendar" }),
  ).toBeVisible();

  for (const width of [1440, 1024, 768, 390, 375]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`smart-page-rich-${width}.png`),
      fullPage: true,
    });
  }
});
