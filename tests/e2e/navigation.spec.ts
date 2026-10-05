import { devices, expect } from "@playwright/test";
import { test as fixture } from "./fixtures";

const test = fixture;

test.use({ ...devices["iPhone 13"], browserName: "chromium" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("menu mobile abre, navega e fecha ao escolher um destino", async ({
  page,
}) => {
  // Em telas estreitas a navegação do cabeçalho fica atrás do botão de menu.
  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toBeHidden();

  const toggle = page.getByRole("button", { name: "Abrir menu" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();

  await expect(
    page.getByRole("button", { name: "Fechar menu" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page
    .locator(".mobile-nav-group summary")
    .filter({ hasText: "Campanhas" })
    .click();
  await expect(page.getByRole("link", { name: "UTM Builder" })).toBeVisible();

  await page.getByRole("link", { name: "UTM Builder" }).click();

  await expect(page).toHaveURL(/\/produtos\/utm-builder$/);
  // O menu recolhe ao navegar.
  await expect(
    page.getByRole("button", { name: "Abrir menu" }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("cada destino do menu mobile abre a ferramenta correta", async ({
  page,
}) => {
  for (const [category, link, path, heading] of [
    [
      "Criar & compartilhar",
      "Link in Bio",
      "/produtos/link-in-bio",
      "Uma página para tudo o que você quer compartilhar.",
    ],
    [
      "Inteligência",
      "Analisar Link",
      "/produtos/analisar-link",
      "Entenda um link antes de compartilhar.",
    ],
  ] as const) {
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page
      .locator(".mobile-nav-group summary")
      .filter({ hasText: category })
      .click();
    await page.getByRole("link", { name: link }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
});

test("mega menu agrupa produtos e fecha com Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const productMenu = page.locator(".desktop-nav .header-menu").first();
  await productMenu.locator("summary").click();

  await expect(productMenu).toHaveAttribute("open", "");
  await expect(productMenu.getByText("Criar & compartilhar")).toBeVisible();
  await expect(productMenu.getByText("Inteligência")).toBeVisible();
  await expect(productMenu.getByText("Ferramentas gratuitas")).toBeVisible();
  await expect(productMenu.getByText("Em destaque")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(productMenu).not.toHaveAttribute("open", "");
});

test("CTA público encaminha cadastro e produtos canônicos", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.locator(".header-cta")).toHaveAttribute(
    "href",
    "/cadastro?next=/conta",
  );

  const productMenu = page.locator(".desktop-nav .header-menu").first();
  await productMenu.locator("summary").click();
  await productMenu
    .getByRole("link", { name: "Criar meu Link in Bio" })
    .click();

  await expect(page).toHaveURL(/\/produtos\/link-in-bio$/);
});
