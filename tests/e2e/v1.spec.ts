import { expect, test } from "@playwright/test";

test("UTM Builder preserva o destino e permite abrir a campanha", async ({
  page,
}) => {
  await page.goto("/gerar-utm");
  await page
    .getByLabel("URL de destino")
    .fill("https://example.com/oferta?id=7#detalhes");
  await page.getByLabel("Campaign Source").fill("newsletter");
  await page.getByLabel("Campaign Medium").fill("email");
  await page.getByLabel("Campaign Name").fill("lançamento");
  await page.getByRole("button", { name: "Criar URL com UTM" }).click();
  await expect(
    page.getByRole("heading", { name: "Sua campanha está pronta." }),
  ).toBeVisible();
  const open = page.getByRole("link", { name: "Abrir", exact: true });
  const destination = new URL((await open.getAttribute("href"))!);
  expect(destination.searchParams.get("id")).toBe("7");
  expect(destination.searchParams.get("utm_campaign")).toBe("lançamento");
  expect(destination.hash).toBe("#detalhes");
  await expect(open).toHaveAttribute("target", "_blank");
  await expect(open).toHaveAttribute("rel", "noopener noreferrer");
  await page.route("https://example.com/**", (route) =>
    route.fulfill({ body: "Destino de teste" }),
  );
  const popupPromise = page.waitForEvent("popup");
  await open.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(destination.toString());
});

test("UTM Builder trata falha de rede e permite tentar novamente", async ({
  page,
}) => {
  await page.goto("/gerar-utm");
  await page.getByLabel("URL de destino").fill("https://example.com/");
  await page.getByLabel("Campaign Source").fill("news");
  await page.getByLabel("Campaign Medium").fill("email");
  await page.getByLabel("Campaign Name").fill("v1");
  await page.route("**/api/utm/generate", (route) => route.abort());
  await page.getByRole("button", { name: "Criar URL com UTM" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Falha de conexão",
  );
  await expect(
    page.getByRole("button", { name: "Criar URL com UTM" }),
  ).toBeEnabled();
  await page.unroute("**/api/utm/generate");
  await page.getByRole("button", { name: "Criar URL com UTM" }).click();
  await expect(
    page.getByRole("heading", { name: "Sua campanha está pronta." }),
  ).toBeVisible();
});

test("QR Code mantém a URL gerada ao editar o campo e baixa o PNG", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/gerar-qrcode");
  await page
    .getByLabel("URL para o QR Code")
    .fill("https://example.com/original");
  await page
    .getByRole("button", { name: "Gerar QR Code", exact: true })
    .click();
  const qr = page.getByRole("img", {
    name: "QR Code para https://example.com/original",
    exact: true,
  });
  await expect(qr).toBeVisible();
  await page
    .getByLabel("URL para o QR Code")
    .fill("https://example.com/editado");
  await expect(qr).toBeVisible();
  await page.getByRole("button", { name: "Copiar", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("https://example.com/original");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("arrume-meu-link-qrcode.png");
  expect(await download.failure()).toBeNull();
  await page.route("**/api/qr/generate", (route) => route.abort());
  await page
    .getByRole("button", { name: "Gerar QR Code", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Falha de conexão",
  );
  await expect(qr).toHaveCount(0);
});

test("histórico persiste após recarregar e permite remover", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/historico?utm_source=x&id=7");
  await page.getByRole("button", { name: "Arrumar meu link" }).click();
  const history = page.getByRole("region", { name: "Histórico recente" });
  await expect(history).toContainText("example.com/historico");
  await page.reload();
  await expect(history).toContainText("example.com/historico");
  await history.getByRole("button", { name: "Remover", exact: false }).click();
  await expect(history).toHaveCount(0);
  await page.reload();
  await expect(history).toHaveCount(0);
});

test("histórico corrompido não quebra a página e storage bloqueado não impede limpar", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "arrume-meu-link:history",
      JSON.stringify([
        null,
        {},
        { id: "bad", cleanUrl: "javascript:alert(1)" },
      ]),
    );
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/?utm_source=x&id=1");
  await page.getByRole("button", { name: "Arrumar meu link" }).click();
  await expect(
    page.getByRole("region", { name: "Seu link está limpo." }),
  ).toContainText("https://example.com/?id=1");
  expect(errors).toEqual([]);
});

test("negação do clipboard exibe instrução sem erro não tratado", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/");
  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/?utm_source=x");
  await page.getByRole("button", { name: "Arrumar meu link" }).click();
  await page
    .getByRole("region", { name: "Seu link está limpo." })
    .getByRole("button", { name: "Copiar", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "copie manualmente",
  );
});

test("analytics chega à API sem URL privada nem query string", async ({
  page,
}) => {
  const events: Array<{ event: string; path: string }> = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/analytics") && request.method() === "POST")
      events.push(request.postDataJSON());
  });
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/analytics") &&
      response.request().postDataJSON()?.event === "page_view",
  );
  await page.goto("/gerar-qrcode?url=https%3A%2F%2Fprivate.example%2Fsecret");
  expect((await responsePromise).status()).toBe(204);
  expect(events).toEqual([{ event: "page_view", path: "/gerar-qrcode" }]);
});

test("verificação de acesso rejeita localhost pela API real", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Cole seu link aqui").fill("http://127.0.0.1/");
  await page.getByRole("button", { name: "Arrumar meu link" }).click();
  const responsePromise = page.waitForResponse("**/api/links/check");
  await page.getByRole("button", { name: "Verificar acesso" }).click();
  const response = await responsePromise;
  expect((await response.json()).code).toBe("UNSAFE_URL");
  await expect(page.getByRole("status")).toBeVisible();
});

test("páginas têm SEO e hidratam sem erros em navegador sem extensões", async ({
  page,
  request,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration|hydrated|didn't match/i.test(message.text()))
      errors.push(message.text());
  });
  for (const path of ["/", "/limpar-link", "/gerar-utm", "/gerar-qrcode"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      path === "/" ? baseURL! : `${baseURL}${path}`,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /.+/,
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  }
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("/gerar-utm");
  expect((await request.get("/robots.txt")).ok()).toBe(true);
  expect(errors).toEqual([]);
});
