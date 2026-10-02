import { grantTestPremium, testDatabase } from "../helpers/premium";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

async function register(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string,
) {
  const result = await request.post("/api/auth/sign-up/email", {
    headers: {
      origin: baseURL,
      "x-real-ip": `198.18.${Math.floor(Math.random() * 240)}.5`,
    },
    data: {
      name: "Workspace UX",
      email: `smart-ux-${randomUUID()}@example.com`,
      password: "Uma senha forte para teste! 2026",
    },
  });
  expect(result.status(), await result.text()).toBe(200);
  const workspace = await (
    await request.get(`${baseURL}/api/workspaces`)
  ).json();
  await grantTestPremium(workspace.activeId);
}

test("Smart Pages loads, previews profile changes, saves and publishes", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await register(context.request, baseURL!);
  await page.goto("/untrack/smart-pages");
  await expect(
    page.getByRole("heading", { name: "Smart Pages", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Não foi possível carregar o workspace.", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Nova página/ }).click();
  await page.getByLabel("Nome ou marca").fill("Aurora Studio");
  await page
    .locator('form.smart-page-create input[name="slug"]')
    .fill(`aurora-${randomUUID().slice(0, 8)}`);
  await page
    .getByLabel("Descrição curta")
    .fill("Projetos e contato em um só lugar.");
  await page.getByRole("button", { name: "Criar página", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Aurora Studio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Abrir página", exact: true }),
  ).toHaveCount(0);
  await page
    .locator('form.smart-page-profile-form input[name="title"]')
    .fill("Aurora Design");
  await expect(
    page.getByRole("button", { name: "Publicar", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Aparência", exact: true }).click();
  await page
    .getByRole("button", { name: "Usar modelo Atelier", exact: true })
    .click();
  if (await page.getByRole("tab", { name: "Prévia", exact: true }).isVisible())
    await page.getByRole("tab", { name: "Prévia", exact: true }).click();
  await expect(page.locator(".smart-page-preview strong")).toHaveText(
    "Aurora Design",
  );
  await expect(
    page.locator('.smart-page-preview [data-theme="editorial"]'),
  ).toBeVisible();
  if (await page.getByRole("tab", { name: "Editar", exact: true }).isVisible())
    await page.getByRole("tab", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(page.getByText("Perfil salvo.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Links", exact: true }).click();
  await page
    .locator('form.smart-page-add-block input[name="title"]')
    .fill("Conheça nossos projetos");
  await page
    .locator('form.smart-page-add-block input[name="destinationUrl"]')
    .fill("https://example.com/portfolio");
  await page
    .getByRole("button", { name: "Adicionar link", exact: true })
    .click();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(
    page.getByText("Página publicada.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Abrir página", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copiar endereço", exact: true }),
  ).toBeVisible();
  const publicPath = await page
    .getByRole("link", { name: "Abrir página", exact: true })
    .getAttribute("href");
  const published = await context.newPage();
  await published.goto(publicPath!);
  await expect(published.locator('[data-theme="editorial"]')).toBeVisible();
  await expect(
    published.getByRole("heading", { name: "Aurora Design" }),
  ).toBeVisible();
  await expect(
    published.getByRole("link", { name: "Conheça nossos projetos" }),
  ).toHaveAttribute("href", "https://example.com/portfolio");
  await published.screenshot({
    path: testInfo.outputPath("atelier-public.png"),
    fullPage: true,
  });
  await published.close();
  await page.getByRole("button", { name: /Biblioteca de páginas/ }).click();
  const listing = page.waitForResponse((response) =>
    response.url().includes("/api/smart-pages?page=1&search="),
  );
  await page.getByLabel("Buscar por nome ou endereço").fill("não existe");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await listing;
  await expect(
    page.getByText("Nenhuma página encontrada. Tente outro nome ou endereço."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("smart-pages.png"),
    fullPage: true,
  });
});

test("a foreign workspace cookie has a recoverable selector, without exposing its data", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await register(context.request, baseURL!);
  const other = await browser.newContext();
  await register(other.request, baseURL!);
  const response = await other.request.get(`${baseURL}/api/workspaces`);
  const workspaceId = (await response.json()).activeId;
  await context.addCookies([
    { name: "untrack.workspace", value: workspaceId, url: baseURL! },
  ]);
  await page.goto("/untrack/smart-pages");
  await expect(
    page.getByRole("heading", { name: "Escolha um workspace" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Abrir seletor de workspace" })
    .click();
  const selector = page.getByRole("combobox", {
    name: "Workspace",
    exact: true,
  });
  await expect(selector.locator(`option[value="${workspaceId}"]`)).toHaveCount(
    0,
  );
  const ownMemberships = await (
    await context.request.get("/api/workspaces")
  ).json();
  const ownId = ownMemberships.items[0].workspace.id as string;
  await expect(selector).toBeVisible();
  await selector.selectOption(ownId!);
  await expect(
    page.getByRole("heading", { name: "Smart Pages", exact: true }),
  ).toBeVisible();
  await other.close();
});

test("viewer can read a shared page but cannot edit it in the UI or API", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await register(context.request, baseURL!);
  const own = await (await context.request.get("/api/workspaces")).json();
  const created = await context.request.post("/api/smart-pages", {
    data: {
      title: "Página compartilhada",
      slug: `shared-${randomUUID().slice(0, 8)}`,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const smartPage = await created.json();
  const viewerContext = await browser.newContext();
  const email = `viewer-${randomUUID()}@example.com`;
  await viewerContext.request.post(`${baseURL}/api/auth/sign-up/email`, {
    data: {
      name: "Leitor",
      email,
      password: "Uma senha forte para teste! 2026",
    },
    headers: { origin: baseURL! },
  });
  const otherPage = await viewerContext.request.get(
    `${baseURL}/api/smart-pages/${smartPage.id}`,
  );
  expect(otherPage.status()).toBe(404);
  const membership = await context.request.post("/api/workspace/members", {
    data: { data: { email, role: "viewer" } },
  });
  expect(membership.status(), await membership.text()).toBe(200);
  await viewerContext.request.post(`${baseURL}/api/workspaces`, {
    data: { action: "select", workspaceId: own.activeId },
  });
  const viewerPage = await viewerContext.newPage();
  await viewerPage.goto(`${baseURL}/untrack/smart-pages`);
  await expect(
    viewerPage.getByText("Você tem acesso de leitura.", { exact: false }),
  ).toBeVisible();
  await viewerPage
    .getByRole("button", { name: /Página compartilhada/ })
    .click();
  await expect(
    viewerPage.locator('form.smart-page-profile-form input[name="title"]'),
  ).toBeDisabled();
  await expect(
    viewerPage.getByRole("button", { name: "Publicar", exact: true }),
  ).toBeDisabled();
  expect(
    (
      await viewerContext.request.patch(
        `${baseURL}/api/smart-pages/${smartPage.id}`,
        { data: { title: "Não permitido" } },
      )
    ).status(),
  ).toBe(403);
  await viewerContext.close();
  // Keep the owner page untouched by the viewer's failed mutation.
  const unchanged = await context.request.get(
    `/api/smart-pages/${smartPage.id}`,
  );
  expect((await unchanged.json()).title).toBe("Página compartilhada");
  await page.goto("/untrack/smart-pages");
});

test("field errors explain slug issues; career templates preserve and publish real content", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await register(context.request, baseURL!);
  await page.goto("/untrack/smart-pages");
  await page.getByRole("button", { name: /Nova página/ }).click();
  await page.getByLabel("Nome ou marca").fill("Ana Silva");
  const createSlug = page.locator('.smart-page-create input[name="slug"]');
  await createSlug.fill("ana--silva");
  await page.getByRole("button", { name: "Criar página", exact: true }).click();
  await expect(createSlug).toBeFocused();
  await expect(createSlug).toHaveAttribute("aria-invalid", "true");
  await expect(createSlug).toHaveAccessibleDescription(/hífens repetidos/);
  await expect(
    page.locator('.smart-page-create input[name="title"]'),
  ).toHaveValue("Ana Silva");
  const slug = `ana-${randomUUID().slice(0, 8)}`;
  await createSlug.fill(slug);
  await page.getByRole("button", { name: "Criar página", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ana Silva", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Aparência", exact: true }).click();
  await page.getByRole("button", { name: /^Currículos/ }).click();
  await expect(page.getByRole("button", { name: /Usar modelo/ })).toHaveCount(
    3,
  );
  await page.getByLabel("Buscar modelos").fill("não existe");
  await expect(page.getByText("Nenhum modelo encontrado")).toBeVisible();
  await page.getByLabel("Buscar modelos").fill("trajetoria");
  await expect(page.getByRole("button", { name: /Usar modelo/ })).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Usar modelo Trajetória" }).click();
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(page.getByText("Perfil salvo.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Perfil", exact: true }).click();
  const profileSlug = page.locator(
    '.smart-page-profile-form input[name="slug"]',
  );
  await profileSlug.fill("ana com espaços");
  await page.getByRole("tab", { name: "Aparência", exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(profileSlug).toBeVisible();
  await expect(profileSlug).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("field-error.png"),
    fullPage: true,
  });
  await profileSlug.fill(slug);
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(page.getByText("Perfil salvo.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Links", exact: true }).click();
  await page
    .locator('.smart-page-add-block input[name="title"]')
    .fill("Meu LinkedIn");
  await page
    .locator('.smart-page-add-block input[name="destinationUrl"]')
    .fill("https://www.linkedin.com/in/example");
  await page
    .getByRole("button", { name: "Adicionar link", exact: true })
    .click();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(
    page.getByText("Página publicada.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Aparência", exact: true }).click();
  await page.getByLabel("Buscar modelos").fill("");
  await page.getByRole("button", { name: /^Portfólios/ }).click();
  await expect(page.getByRole("button", { name: /Usar modelo/ })).toHaveCount(
    3,
  );
  await page.screenshot({
    path: testInfo.outputPath("portfolio-gallery.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const publicPage = await context.newPage();
  await publicPage.goto(`/page/${slug}`);
  await expect(publicPage.locator('[data-theme="resume"]')).toBeVisible();
  await expect(
    publicPage.getByRole("heading", { name: "Ana Silva" }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("link", { name: "Meu LinkedIn" }),
  ).toHaveAttribute("href", "https://www.linkedin.com/in/example");
  await expect(
    publicPage.getByText("Ana Martins", { exact: true }),
  ).toHaveCount(0);
  await publicPage.screenshot({
    path: testInfo.outputPath("resume-public.png"),
    fullPage: true,
  });
  await publicPage.close();
});

test("server conflicts and invalid social URLs point to the correct form field", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const other = await browser.newContext();
  try {
    await register(other.request, baseURL!);
    const takenSlug = `taken-${randomUUID().slice(0, 8)}`;
    const created = await other.request.post(`${baseURL}/api/smart-pages`, {
      data: { title: "Outra página", slug: takenSlug },
    });
    expect(created.status()).toBe(201);
    await register(context.request, baseURL!);
    await page.goto("/untrack/smart-pages");
    await page.getByRole("button", { name: /Nova página/ }).click();
    await page.getByLabel("Nome ou marca").fill("Perfil profissional");
    const slug = page.locator('.smart-page-create input[name="slug"]');
    await slug.fill(takenSlug);
    await page
      .getByRole("button", { name: "Criar página", exact: true })
      .click();
    await expect(slug).toHaveAttribute("aria-invalid", "true");
    await expect(slug).toHaveAccessibleDescription(
      /já pertence a outra página/,
    );
    await expect(slug).toBeFocused();
    await slug.fill(`my-${randomUUID().slice(0, 8)}`);
    await page
      .getByRole("button", { name: "Criar página", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Perfil profissional", exact: true }),
    ).toBeVisible();
    const socialComposer = page.locator(".sp-social-composer");
    await socialComposer.getByRole("button", { name: "Adicionar" }).click();
    await socialComposer
      .getByRole("button", { name: "Adicionar LinkedIn" })
      .click();
    const linkedin = socialComposer.locator('input[name="social-linkedin"]');
    await linkedin.fill("ftp://example.com/profile");
    await page.getByRole("tab", { name: "Aparência", exact: true }).click();
    await page
      .getByRole("button", { name: "Salvar perfil", exact: true })
      .click();
    await expect(linkedin).toBeVisible();
    await expect(linkedin).toBeFocused();
    await expect(linkedin).toHaveAttribute("aria-invalid", "true");
    await expect(linkedin).toHaveAccessibleDescription(/HTTP ou HTTPS/);
    await expect(linkedin).toHaveValue("ftp://example.com/profile");
    await linkedin.fill("https://www.linkedin.com/in/example");
    await page
      .getByRole("button", { name: "Salvar perfil", exact: true })
      .click();
    await expect(
      page.getByText("Perfil salvo.", { exact: true }),
    ).toBeVisible();
    await expect(linkedin).toHaveAttribute("aria-invalid", "false");
  } finally {
    await other.close();
  }
});

test("live card customization, upload isolation, reorder and downgrade", async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  await register(context.request, baseURL!);
  const created = await context.request.post("/api/smart-pages", {
    data: { title: "Cartão ao vivo", slug: `card-${randomUUID().slice(0, 8)}` },
  });
  expect(created.status()).toBe(201);
  const record = await created.json();
  await context.request.post(`/api/smart-pages/${record.id}/blocks`, {
    data: {
      type: "link",
      settings: { title: "Portfólio", destinationUrl: "https://example.com" },
    },
  });
  await page.goto("/untrack/smart-pages");
  await page.getByRole("button", { name: /Cartão ao vivo/ }).click();
  const name = page.locator('.smart-page-profile-form input[name="title"]');
  await name.fill("Meu novo cartão");
  await expect(page.locator(".smart-page-preview strong")).toHaveText(
    "Meu novo cartão",
  );
  const sharp = (await import("sharp")).default;
  const image = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#336699" },
  })
    .png()
    .toBuffer();
  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(
    page.locator('.smart-page-profile-form input[name="avatarUrl"]'),
  ).toHaveValue(/api\/smart-page-images/);
  const avatarUrl = await page
    .locator('.smart-page-profile-form input[name="avatarUrl"]')
    .inputValue();
  const visitor = await browser.newContext();
  expect((await visitor.request.get(avatarUrl)).status()).toBe(404);
  await page.getByRole("tab", { name: "Aparência", exact: true }).click();
  await page.getByText("Personalização avançada", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Alinhamento", exact: true })
    .selectOption("left");
  await page
    .getByRole("combobox", { name: "Tipografia", exact: true })
    .selectOption("serif");
  await page.getByRole("button", { name: "Subir Nome", exact: true }).click();
  await expect(
    page.locator('.smart-page-preview [data-alignment="left"]'),
  ).toHaveCount(1);
  await expect(
    page.locator(".smart-page-preview [data-section]").first(),
  ).toHaveAttribute("data-section", "title");
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(page.getByText("Perfil salvo.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Links", exact: true }).click();
  await page.locator(".sp-link-card summary").first().click();
  await page
    .locator('.smart-page-block-list input[name="title"]')
    .fill("Projeto em tempo real");
  await expect(page.locator(".smart-page-preview")).toContainText(
    "Projeto em tempo real",
  );
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Link atualizado.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(
    page.getByText("Página publicada.", { exact: true }),
  ).toBeVisible();
  expect((await visitor.request.get(avatarUrl)).headers()["content-type"]).toBe(
    "image/webp",
  );
  await page.getByRole("tab", { name: "Aparência", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("live-card-editor.png"),
    fullPage: true,
  });
  const publicPage = await visitor.newPage();
  await publicPage.goto(`/page/${record.slug}`);
  await expect(publicPage.locator('[data-layout="card"]')).toBeVisible();
  await expect(
    publicPage.getByRole("heading", { name: "Meu novo cartão" }),
  ).toBeVisible();
  await publicPage.screenshot({
    path: testInfo.outputPath("profile-card.png"),
    fullPage: true,
  });
  const workspace = await (await context.request.get("/api/workspaces")).json();
  await testDatabase((db) =>
    db.workspace.update({
      where: { id: workspace.activeId },
      data: { plan: "free" },
    }),
  );
  expect(
    (
      await context.request.patch(`/api/smart-pages/${record.id}`, {
        data: { title: "Blocked" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await context.request.post(`/api/smart-pages/${record.id}/images`, {
        headers: { "Content-Type": "image/png" },
        data: image,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await context.request.post(`/api/smart-pages/${record.id}/publish`, {
        data: { published: false },
      })
    ).status(),
  ).toBe(200);
  expect((await visitor.request.get(avatarUrl)).status()).toBe(404);
  await visitor.close();
});

test("anonymous allowance is shared and atomic; a free account cannot create premium pages", async ({
  browser,
  baseURL,
}) => {
  const guest = await browser.newContext({
    extraHTTPHeaders: {
      "x-real-ip": `198.19.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
  });
  try {
    const results = await Promise.all([
      guest.request.post(`${baseURL}/api/links/analyze`, {
        data: { url: "https://example.com/?utm_source=test" },
      }),
      guest.request.post(`${baseURL}/api/links/clean`, {
        data: { url: "https://example.org" },
      }),
    ]);
    expect(results.map((r) => r.status()).sort()).toEqual([200, 401]);
    expect(
      (
        await guest.request.post(`${baseURL}/api/utm/generate`, {
          data: {
            url: "https://example.net",
            source: "test",
            medium: "social",
            campaign: "launch",
          },
        })
      ).status(),
    ).toBe(401);
    const signup = await guest.request.post(
      `${baseURL}/api/auth/sign-up/email`,
      {
        headers: { origin: baseURL! },
        data: {
          name: "Free account",
          email: `free-${randomUUID()}@example.com`,
          password: "Senha de teste forte! 2026",
        },
      },
    );
    expect(signup.status()).toBe(200);
    expect(
      (
        await guest.request.post(`${baseURL}/api/links/analyze`, {
          data: { url: "https://example.org" },
        })
      ).status(),
    ).toBe(200);
    const premium = await guest.request.post(`${baseURL}/api/smart-pages`, {
      data: { title: "Premium", slug: `free-${randomUUID().slice(0, 8)}` },
    });
    expect(premium.status()).toBe(403);
    expect((await premium.json()).code).toBe("PREMIUM_REQUIRED");
  } finally {
    await guest.close();
  }
});
