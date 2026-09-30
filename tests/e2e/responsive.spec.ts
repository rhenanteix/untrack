import { expect, test } from "@playwright/test";

const VIEWPORTS = [320, 375, 390, 430, 768, 1024, 1440] as const;
const ROUTES = ["/", "/limpar-link", "/gerar-utm", "/gerar-qrcode"] as const;

for (const width of VIEWPORTS) {
  test(`não há overflow horizontal em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });

    for (const route of ROUTES) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `overflow horizontal em ${route} a ${width}px`,
      ).toBeLessThanOrEqual(1);
    }
  });
}

test("em telas estreitas a navegação usa o menu e o alvo de toque é adequado", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toBeHidden();

  const toggle = page.getByRole("button", { name: "Abrir menu" });
  const box = await toggle.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(40);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

  await toggle.click();
  await expect(
    page.getByRole("link", { name: "Criar UTM" }).last(),
  ).toBeVisible();
});

test("em telas largas a navegação horizontal substitui o menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/");

  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeHidden();
});

test("o formulário empilha o botão abaixo do campo no celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");

  const input = page.getByLabel("Cole seu link aqui");
  const button = page.getByRole("button", { name: "Arrumar meu link" });

  const inputBox = await input.boundingBox();
  const buttonBox = await button.boundingBox();

  expect(buttonBox!.y).toBeGreaterThan(inputBox!.y + inputBox!.height - 5);
  expect(buttonBox!.width).toBeGreaterThan(inputBox!.width - 5);
});
