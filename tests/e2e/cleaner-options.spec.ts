import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/limpar-link");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("desmarcar uma categoria preserva os rastreadores dela", async ({
  page,
}) => {
  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/p?utm_source=x&gclid=y&fbclid=z&id=7");

  await page.getByLabel("Google tracking").uncheck();
  await page.getByLabel("UTMs").uncheck();
  await page.getByRole("button", { name: "Arrumar meu link" }).click();

  const result = page.getByRole("region", { name: "Seu link está limpo." });
  // Só Meta ficou habilitada; utm_source e gclid mantêm a ordem original.
  await expect(result).toContainText(
    "https://example.com/p?utm_source=x&gclid=y&id=7",
  );
  await expect(result).toContainText("1rastreadores removidos");
  await expect(result).toContainText("3parâmetros preservados");
});

test("a categoria de genéricos permite preservar si e share_id", async ({
  page,
}) => {
  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://youtube.com/watch?v=abc&si=xyz&share_id=q&id=7");

  // Habilitado por padrão: os genéricos são removidos.
  await page.getByRole("button", { name: "Arrumar meu link" }).click();
  await expect(
    page.getByRole("region", { name: "Seu link está limpo." }),
  ).toContainText("https://youtube.com/watch?v=abc&id=7");

  // Desmarcando, os parâmetros ambíguos passam a ser preservados.
  await page.getByLabel("Outros rastreadores").uncheck();
  await page.getByRole("button", { name: "Arrumar meu link" }).click();
  await expect(
    page.getByRole("region", { name: "Seu link está limpo." }),
  ).toContainText("https://youtube.com/watch?v=abc&si=xyz&share_id=q&id=7");
});

test("as estatísticas sempre somam o total de parâmetros", async ({ page }) => {
  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/?utm_source=a&utm_source=b&id=1&id=2&q=x");

  await page.getByRole("button", { name: "Arrumar meu link" }).click();

  const result = page.getByRole("region", { name: "Seu link está limpo." });
  await expect(result).toContainText("5parâmetros encontrados");
  await expect(result).toContainText("2rastreadores removidos");
  await expect(result).toContainText("3parâmetros preservados");
});
