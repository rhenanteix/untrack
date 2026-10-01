import { devices, expect, test } from "@playwright/test";

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
      "Links",
      "Link Cleaner",
      "/produtos/link-cleaner",
      "Compartilhe links sem o ruído do tracking.",
    ],
    [
      "Campanhas",
      "QR Code",
      "/produtos/qr-code",
      "Crie QR Codes que você consegue acompanhar.",
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
