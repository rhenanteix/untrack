import axe, { type AxeResults } from "axe-core";
import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import templates from "../../prisma/seeds/templates.json";
import { testDatabase } from "../helpers/premium";

test("template gallery filters, previews, keyboard access and draft creation", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  await testDatabase(async (db) => {
    for (const template of templates) {
      await db.smartPageTemplate.upsert({
        where: { slug: template.slug },
        create: {
          ...template,
          plan: template.plan as "free" | "premium",
          published: true,
        },
        update: {},
      });
    }
  });
  const signup = await context.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL! },
    data: {
      name: "Gallery Test",
      email: `gallery-${randomUUID()}@example.com`,
      password: "Gallery test password! 2026",
    },
  });
  expect(signup.status()).toBe(200);
  const events: Array<{ event: string; context?: Record<string, string> }> = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/analytics") && request.method() === "POST")
      events.push(request.postDataJSON());
  });
  await page.goto("/untrack/smart-pages");
  await page.getByRole("button", { name: /Nova página/ }).click();
  const gallery = page.getByRole("region", { name: "Galeria de templates" });
  await expect(
    gallery.getByRole("heading", { name: "Criador essencial" }),
  ).toBeVisible({ timeout: 60_000 });
  await page.addScriptTag({
    content: axe.source,
  });
  const accessibility = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: (context: Element) => Promise<AxeResults> };
      }
    ).axe;
    return (
      await axe.run(
        document.querySelector('[aria-label="Galeria de templates"]')!,
      )
    ).violations;
  });
  expect(accessibility).toEqual([]);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({
    width: testInfo.project.name === "mobile" ? 390 : 1440,
    height: 900,
  });
  await gallery
    .getByRole("searchbox", { name: "Buscar templates" })
    .fill("Criador");
  await expect(gallery.getByRole("listitem")).toHaveCount(1);
  await gallery.getByRole("button", { name: "Limpar filtros" }).click();
  await gallery.getByLabel("Plano", { exact: true }).selectOption("free");
  await expect(gallery.getByRole("listitem")).toHaveCount(3);
  const preview = gallery.getByRole("button", {
    name: "Visualizar Criador essencial",
    exact: true,
  });
  await preview.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Preview: Criador essencial",
  });
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await expect(
    dialog.getByRole("button", { name: "Fechar preview" }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Visualização desktop" }).click();
  await expect(
    dialog.getByRole("button", { name: "Visualização desktop" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(preview).toBeFocused();
  await preview.click();
  await dialog.getByRole("button", { name: "Usar este template" }).click();
  await expect(
    page.getByText(
      "Página criada a partir do template. Personalize e publique quando estiver pronto.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Criador essencial", exact: true }),
  ).toBeVisible();
  for (const event of [
    "template_gallery_viewed",
    "template_searched",
    "template_filters_cleared",
    "template_filtered",
    "template_previewed",
    "template_preview_closed",
    "template_preview_device_changed",
    "template_selected",
  ])
    expect(events.map((entry) => entry.event)).toContain(event);
  expect(events.filter((entry) => entry.event === "template_searched")).toEqual(
    [
      {
        event: "template_searched",
        path: "/untrack/smart-pages",
        context: { product: "smart-pages" },
      },
    ],
  );
});
