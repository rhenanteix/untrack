import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("limpa um rastreador pela API da aplicação", async ({ page }) => {
  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/produto?utm_source=newsletter&id=42");
  await page.getByRole("button", { name: "Arrumar meu link" }).click();

  const result = page.getByRole("region", { name: "Seu link está limpo." });
  await expect(result).toContainText("https://example.com/produto?id=42");
  await expect(result).toContainText(/1\s*rastreadores removidos/);
  await expect(result).toContainText(/1\s*parâmetros preservados/);
});

test("exibe erro para URL inválida", async ({ page }) => {
  await page.getByLabel("Cole seu link aqui").fill("isto não é uma url");
  await page.getByRole("button", { name: "Arrumar meu link" }).click();

  await expect(page.getByText("Verifique os dados informados.")).toContainText(
    "Verifique os dados informados",
  );
  await expect(
    page.getByRole("heading", { name: "Seu link está limpo." }),
  ).toHaveCount(0);
});

test("informa resultado sem rastreamento sem alterar parâmetros", async ({
  page,
}) => {
  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/busca?q=camisa&page=2");
  await page.getByRole("button", { name: "Arrumar meu link" }).click();

  const result = page.getByRole("region", { name: "Seu link está limpo." });
  await expect(result).toContainText(
    "https://example.com/busca?q=camisa&page=2",
  );
  await expect(result).toContainText(/0\s*rastreadores removidos/);
  await expect(result).toContainText(/2\s*parâmetros preservados/);
});

test("remove vários trackers e preserva parâmetros legítimos repetidos", async ({
  page,
}) => {
  await page
    .getByLabel("Cole seu link aqui")
    .fill(
      "https://example.com/p?utm_source=x&gclid=y&fbclid=z&id=7&tag=azul&tag=grande",
    );
  await page.getByRole("button", { name: "Arrumar meu link" }).click();

  const result = page.getByRole("region", { name: "Seu link está limpo." });
  await expect(result).toContainText(
    "https://example.com/p?id=7&tag=azul&tag=grande",
  );
  await expect(result).toContainText(/3\s*rastreadores removidos/);
  await expect(result).toContainText(/3\s*parâmetros preservados/);
});

test("copia o link limpo", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/?utm_campaign=promo&id=9");
  await page.getByRole("button", { name: "Arrumar meu link" }).click();
  await page.getByRole("button", { name: "Copiar" }).first().click();

  await expect(
    page.getByRole("button", { name: "Link copiado!" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("https://example.com/?id=9");
});

test("navega ao gerador e cria QR Code pela API da aplicação", async ({
  page,
}) => {
  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/oferta?utm_medium=social&id=5");
  await page.getByRole("button", { name: "Arrumar meu link" }).click();
  await page.getByRole("link", { name: "Gerar QR Code" }).click();

  await expect(page).toHaveURL(/\/gerar-qrcode\?url=/);
  await expect(page.getByLabel("URL para o QR Code")).toHaveValue(
    "https://example.com/oferta?id=5",
  );
  await page.getByRole("button", { name: "Gerar QR Code" }).click();
  await expect(
    page.getByRole("heading", { name: "Escaneie ou baixe." }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /QR Code para/ })).toHaveAttribute(
    "src",
    /^data:image\/png;base64,/,
  );
});
