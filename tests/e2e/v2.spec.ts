import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "./fixtures";

const password = "Senha de teste V2! 2026";
function testIp() {
  const bytes = randomBytes(2);
  return `198.18.${bytes[0]}.${bytes[1]}`;
}

async function register(request: APIRequestContext, baseURL: string) {
  const email = `v2-${randomUUID()}@example.com`;
  const response = await request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL, "x-real-ip": testIp() },
    data: { email, password, name: "Pessoa de teste" },
  });
  expect(response.status(), await response.text()).toBe(200);
  return email;
}

async function createLink(request: APIRequestContext) {
  const response = await request.post("/api/short-links", {
    data: {
      url: "https://example.com/campanha?id=7",
      title: "Campanha de teste",
      description: "Conheça a campanha.",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json() as Promise<{
    id: string;
    slug: string;
    shortUrl: string;
    shareUrl: string;
  }>;
}

test("cadastro, sessão, logout e login funcionam pela interface", async ({
  page,
  context,
  baseURL,
}) => {
  await context.setExtraHTTPHeaders({ "x-real-ip": testIp() });
  const email = `v2-ui-${randomUUID()}@example.com`;
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome").fill("Maria Teste");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(`${baseURL}/conta`);
  await expect(
    page.getByRole("heading", { name: "Olá, Maria Teste." }),
  ).toBeVisible();
  const session = (await context.cookies()).find((cookie) =>
    cookie.name.includes("session_token"),
  );
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Olá, Maria Teste." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(`${baseURL}/entrar`);
  expect((await context.request.get("/api/short-links")).status()).toBe(401);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha incorreta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "E-mail ou senha incorretos.",
  );
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/conta`);
});

test("cria um link, compartilha a página pública e mostra métricas privadas", async ({
  page,
  context,
  baseURL,
}) => {
  await register(context.request, baseURL!);
  await page.goto("/encurtar");
  await page
    .getByLabel("Link de destino")
    .fill("https://example.com/destino?utm_source=v2&id=7");
  await page.getByLabel("Título (opcional)").fill("Minha campanha V2");
  await page
    .getByLabel("Descrição pública (opcional)")
    .fill("Um destino para compartilhar.");
  const creation = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/short-links") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Criar link curto" }).click();
  const response = await creation;
  expect(response.status()).toBe(201);
  const link = await response.json();
  await expect(
    page.getByRole("region", { name: "Link curto criado" }),
  ).toContainText(link.shortUrl);
  await page.getByRole("link", { name: "Ver página pública" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Minha campanha V2",
  );
  await expect(
    page.getByRole("img", { name: "QR Code do link curto" }),
  ).toHaveAttribute("src", /^data:image\/png;base64,/);
  const visit = await context.request.get(`/s/${link.slug}`, {
    maxRedirects: 0,
    headers: {
      "user-agent": "Mozilla/5.0 Mobile",
      referer: "https://news.example/post?secret=hidden",
    },
  });
  expect(visit.status()).toBe(302);
  expect(visit.headers().location).toBe(
    "https://example.com/destino?utm_source=v2&id=7",
  );
  expect(visit.headers()["cache-control"]).toBe("no-store");
  await page.goto(`/conta/links/${link.id}`);
  await expect(page.getByTestId("total-clicks")).toHaveText("1");
  await expect(page.getByRole("main")).toContainText("news.example");
  await expect(page.getByRole("main")).not.toContainText("secret=hidden");
  await expect(page.getByRole("main")).toContainText("Celular");
  await page.getByLabel("Período").selectOption("7");
  await expect(
    page.getByRole("img", { name: /Cliques diários nos últimos 7 dias/ }),
  ).toBeVisible();
});

test("métricas ignoram HEAD, robôs conhecidos e prefetch", async ({
  context,
  baseURL,
}) => {
  await register(context.request, baseURL!);
  const link = await createLink(context.request);
  await context.request.head(`/s/${link.slug}`, { maxRedirects: 0 });
  await context.request.get(`/s/${link.slug}`, {
    maxRedirects: 0,
    headers: { "user-agent": "Slackbot-LinkExpanding 1.0" },
  });
  await context.request.get(`/s/${link.slug}`, {
    maxRedirects: 0,
    headers: { purpose: "prefetch" },
  });
  const response = await context.request.get(`/api/short-links/${link.id}`);
  expect((await response.json()).metrics.total).toBe(0);
});

test("uma conta não acessa links, métricas ou histórico de outra", async ({
  browser,
  context,
  baseURL,
}) => {
  await register(context.request, baseURL!);
  const link = await createLink(context.request);
  await context.request.post("/api/links/analyze", {
    data: { url: "https://example.com/?utm_source=x&id=private" },
  });
  const history = (await (await context.request.get("/api/history")).json())
    .items[0];
  const other = await browser.newContext({ baseURL });
  try {
    expect(
      (await other.request.get(`/api/short-links/${link.id}`)).status(),
    ).toBe(401);
    expect((await other.request.get(`/l/${link.slug}`)).status()).toBe(200);
    await register(other.request, baseURL!);
    expect(
      (await other.request.get(`/api/short-links/${link.id}`)).status(),
    ).toBe(404);
    expect(
      (
        await other.request.patch(`/api/short-links/${link.id}`, {
          data: { isActive: false },
        })
      ).status(),
    ).toBe(404);
    expect(
      (await other.request.delete(`/api/short-links/${link.id}`)).status(),
    ).toBe(404);
    expect(
      (await other.request.delete(`/api/history/${history.id}`)).status(),
    ).toBe(404);
    expect(
      (await (await other.request.get("/api/history")).json()).items,
    ).toEqual([]);
    expect((await other.request.get(`/conta/links/${link.id}`)).status()).toBe(
      404,
    );
  } finally {
    await other.close();
  }
});

test("histórico acompanha a conta em outro navegador e importa sem duplicar", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const email = await register(context.request, baseURL!);
  await page.goto("/");
  await page
    .getByLabel("Cole seu link aqui")
    .fill("https://example.com/nuvem?utm_source=x&id=42");
  await page.getByRole("button", { name: "Arrumar meu link" }).click();
  await expect(
    page.getByText("Salvo no histórico da sua conta."),
  ).toBeVisible();
  const other = await browser.newContext({ baseURL });
  try {
    const signIn = await other.request.post("/api/auth/sign-in/email", {
      headers: { origin: baseURL!, "x-real-ip": testIp() },
      data: { email, password },
    });
    expect(signIn.status(), await signIn.text()).toBe(200);
    const otherPage = await other.newPage();
    await otherPage.goto("/conta");
    await expect(
      otherPage.getByRole("region", { name: "Histórico da conta" }),
    ).toContainText("https://example.com/nuvem?id=42");
    expect(
      await otherPage.evaluate(() =>
        localStorage.getItem("arrume-meu-link:history"),
      ),
    ).toBeNull();
  } finally {
    await other.close();
  }
  await page.evaluate(() =>
    localStorage.setItem(
      "arrume-meu-link:history",
      JSON.stringify([
        {
          id: "import-v2",
          originalUrl: "https://example.com/import?utm_source=x",
          cleanUrl: "https://example.com/import",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    ),
  );
  await page.goto("/conta");
  await page
    .getByRole("button", { name: "Importar histórico deste navegador" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "1 registro(s) importado(s)",
  );
  await page
    .getByRole("button", { name: "Importar histórico deste navegador" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "0 registro(s) importado(s)",
  );
  const history = page.getByRole("region", { name: "Histórico da conta" });
  await expect(history.getByRole("listitem")).toHaveCount(2);
  await history
    .getByRole("button", { name: "Remover do histórico" })
    .first()
    .click();
  await expect(history.getByRole("listitem")).toHaveCount(1);
});

test("proprietário desativa, reativa e exclui seu link", async ({
  page,
  context,
  baseURL,
}) => {
  await register(context.request, baseURL!);
  const link = await createLink(context.request);
  await page.goto("/conta");
  await page.getByRole("button", { name: "Desativar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reativar", exact: true }),
  ).toBeVisible();
  expect(
    (
      await context.request.get(`/s/${link.slug}`, { maxRedirects: 0 })
    ).status(),
  ).toBe(404);
  expect((await context.request.get(`/l/${link.slug}`)).status()).toBe(404);
  await page.getByRole("button", { name: "Reativar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Desativar", exact: true }),
  ).toBeVisible();
  expect(
    (
      await context.request.get(`/s/${link.slug}`, { maxRedirects: 0 })
    ).status(),
  ).toBe(302);
  await page.getByRole("button", { name: "Excluir link", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar exclusão", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Seu próximo link começa aqui." }),
  ).toBeVisible();
  expect(
    (
      await context.request.get(`/s/${link.slug}`, { maxRedirects: 0 })
    ).status(),
  ).toBe(404);
});

test("bloqueia origem externa, URL inválida, encadeamento de links e logout revoga sessão", async ({
  context,
  baseURL,
}) => {
  await register(context.request, baseURL!);
  expect(
    (
      await context.request.post("/api/short-links", {
        headers: { origin: "https://evil.example" },
        data: { url: "https://example.com" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await context.request.post("/api/short-links", {
        data: { url: "javascript:alert(1)" },
      })
    ).status(),
  ).toBe(400);
  const link = await createLink(context.request);
  expect(
    (
      await context.request.post("/api/short-links", {
        data: { url: link.shortUrl },
      })
    ).status(),
  ).toBe(400);
  const cookies = await context.cookies();
  const cookie = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const logout = await context.request.post("/api/auth/sign-out", {
    headers: { origin: baseURL! },
    data: {},
  });
  expect(logout.status()).toBe(200);
  expect(
    (
      await context.request.get("/api/history", { headers: { cookie } })
    ).status(),
  ).toBe(401);
});

test("as telas da V2 e o painel cabem em 320px", async ({
  page,
  context,
  baseURL,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ["/entrar", "/cadastro", "/encurtar"]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
  await register(context.request, baseURL!);
  const link = await createLink(context.request);
  for (const path of [
    "/conta",
    "/encurtar",
    `/conta/links/${link.id}`,
    `/l/${link.slug}`,
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
      path,
    ).toBeLessThanOrEqual(1);
  }
});
