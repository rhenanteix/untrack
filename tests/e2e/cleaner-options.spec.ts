import { expect, test } from "./fixtures";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

test.beforeEach(async ({ page }) => {
  await page.goto("/limpar-link");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function signUp(page: import("@playwright/test").Page, baseURL: string) {
  await page.goto("/cadastro");
  const email = `cleaner-${crypto.randomUUID()}@example.com`;
  await page.getByLabel("Seu nome").fill("Cleaner test");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("Senha de teste forte! 2026");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(new RegExp(`${baseURL}/onboarding`));
  await page.goto(`${baseURL}/limpar-link`);
}

test("desmarcar uma categoria preserva os rastreadores dela", async ({
  page,
  baseURL,
}) => {
  await signUp(page, baseURL);

  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/p?utm_source=x&gclid=y&fbclid=z&id=7");

  await page.getByLabel("Google tracking").uncheck();
  await page.getByLabel("UTMs").uncheck();
  await page.getByRole("button", { name: "Arrumar meu link" }).click();

  const result = page.getByRole("region", { name: "Seu link está limpo." });
  await expect(result).toContainText(
    "https://example.com/p?utm_source=x&gclid=y&id=7",
  );
  await expect(result).toContainText("1rastreadores removidos");
  await expect(result).toContainText("3parâmetros preservados");
});

test("a categoria de genéricos permite preservar si e share_id", async ({
  page,
  baseURL,
}) => {
  await signUp(page, baseURL);

  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://youtube.com/watch?v=abc&si=xyz&share_id=q&id=7");

  await page.getByRole("button", { name: "Arrumar meu link" }).click();
  await expect(
    page.getByRole("region", { name: "Seu link está limpo." }),
  ).toContainText("https://youtube.com/watch?v=abc&id=7");

  await page.getByLabel("Outros rastreadores").uncheck();
  await page.getByRole("button", { name: "Arrumar meu link" }).click();
  await expect(
    page.getByRole("region", { name: "Seu link está limpo." }),
  ).toContainText("https://youtube.com/watch?v=abc&si=xyz&share_id=q&id=7");
});

test("as estatísticas sempre somam o total de parâmetros", async ({
  page,
  baseURL,
}) => {
  await signUp(page, baseURL);

  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/?utm_source=a&utm_source=b&id=1&id=2&q=x");

  await page.getByRole("button", { name: "Arrumar meu link" }).click();

  const result = page.getByRole("region", { name: "Seu link está limpo." });
  await expect(result).toContainText("5parâmetros encontrados");
  await expect(result).toContainText("2rastreadores removidos");
  await expect(result).toContainText("3parâmetros preservados");
});
