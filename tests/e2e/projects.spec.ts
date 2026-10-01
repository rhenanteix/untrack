import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

async function register(request: APIRequestContext, baseURL: string, name: string) {
  const response = await request.post(`${baseURL}/api/auth/sign-up/email`, {
    headers: {
      origin: baseURL,
      "x-real-ip": `198.18.${Math.floor(Math.random() * 240)}.15`,
    },
    data: {
      name,
      email: `projects-${randomUUID()}@example.com`,
      password: "Uma senha forte para Projects! 2026",
    },
  });
  expect(response.status(), await response.text()).toBe(200);
}

test("projects can be created, archived and restored without crossing workspaces", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await register(context.request, baseURL!, "Projetos principais");
  await page.goto("/untrack/projects");

  await page.getByRole("button", { name: "Novo projeto" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Black Friday 2026");
  await page
    .getByLabel("Descrição opcional", { exact: true })
    .fill("Ofertas e distribuição da campanha.");
  await page.getByRole("button", { name: "Criar projeto" }).click();

  const projectLink = page.getByRole("link", {
    name: "Black Friday 2026",
    exact: true,
  });
  await expect(projectLink).toBeVisible();
  await projectLink.click();
  await expect(
    page.getByRole("heading", { name: "Black Friday 2026", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Recursos conectados", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Arquivar" }).click();
  await expect(page.getByRole("button", { name: "Restaurar" })).toBeVisible();

  await page.getByRole("link", { name: "← Projetos", exact: true }).click();
  await page.getByLabel("Mostrar", { exact: true }).selectOption("archived");
  await expect(projectLink).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Restaurar Black Friday 2026").click();
  await page.getByLabel("Mostrar", { exact: true }).selectOption("active");
  await expect(projectLink).toBeVisible();

  const other = await browser.newContext();
  try {
    await register(other.request, baseURL!, "Outro workspace");
    const created = await other.request.post(`${baseURL}/api/projects`, {
      data: { name: "Projeto privado" },
    });
    expect(created.status(), await created.text()).toBe(201);
    const foreign = await created.json();

    const deniedRead = await context.request.get(
      `${baseURL}/api/projects/${foreign.id}`,
    );
    expect(deniedRead.status(), await deniedRead.text()).toBe(404);
    const deniedWrite = await context.request.patch(
      `${baseURL}/api/projects/${foreign.id}`,
      { data: { action: "archive" } },
    );
    expect(deniedWrite.status(), await deniedWrite.text()).toBe(404);
  } finally {
    await other.close();
  }
});