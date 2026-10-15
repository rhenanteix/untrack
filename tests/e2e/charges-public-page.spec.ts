import { test, expect, type APIRequestContext } from "@playwright/test";
import { grantTestPremium } from "../helpers/premium";
import { randomUUID } from "node:crypto";

async function register(
  request: APIRequestContext,
  baseURL: string,
) {
  const result = await request.post("/api/auth/sign-up/email", {
    headers: {
      origin: baseURL!,
      "x-real-ip": `198.18.${Math.floor(Math.random() * 240)}.5`,
    },
    data: {
      name: "Share UX",
      email: `share-ux-${randomUUID()}@example.com`,
      password: "Uma senha forte para teste! 2026",
    },
  });
  expect(result.status(), await result.text()).toBe(200);
  const workspace = await (await request.get(`${baseURL}/api/workspaces`)).json();
  await grantTestPremium(workspace.activeId);
}

test.describe("LinkOr Pay public charge page", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await register(context.request, baseURL!);
  });

  async function createCharge(context: APIRequestContext, description: string, amount = 5000) {
    const result = await context.post("/api/charges", {
      data: { description, amountInCents: amount },
    });
    expect(result.status(), await result.text()).toBe(201);
    return (await result.json()) as { id: string };
  }

  test("generates a share token and loads the public page", async ({
    page,
    context,
  }) => {
    await createCharge(context.request, "Taxa de inscrição", 5000);

    await page.goto("/untrack/pay");
    await page.locator(".pay-actions button[title='Compartilhar']").first().click();

    await page.waitForURL(/\/pay\/[a-f0-9]{32}$/);
    await expect(page.locator(".pay-public-amount")).toHaveText("R$ 50,00");
    await expect(page.locator(".pay-public-description")).toHaveText("Taxa de inscrição");
  });

  test("copy link button is wired up", async ({ page, context }) => {
    await createCharge(context.request, "Servico", 1500);
    await page.goto("/untrack/pay");
    await page.locator(".pay-actions button[title='Compartilhar']").first().click();

    await page.waitForURL(/\/pay\/[a-f0-9]{32}$/);
    const button = page.getByRole("button", { name: /Copiar link/ });
    await button.click();
    await expect(button).toBeVisible();
  });

  test("download QR Code button triggers a download", async ({ page, context }) => {
    await createCharge(context.request, "Servico", 1500);
    await page.goto("/untrack/pay");
    await page.locator(".pay-actions button[title='Compartilhar']").first().click();

    await page.waitForURL(/\/pay\/[a-f0-9]{32}$/);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Baixar QR Code/ }).click(),
    ]);
    expect(download.suggestedFilename()).toContain("cobranca");
  });

  test("shows not-found message for invalid token", async ({ page }) => {
    await page.goto("/pay/00000000000000000000000000000000");
    await expect(page.locator(".pay-public-error")).toBeVisible();
  });

  test("cancelled charge is unavailable for sharing", async ({ context }) => {
    const charge = await createCharge(context.request, "Cancelada", 1000);
    await context.request.post(`/api/charges/${charge.id}/cancel`, {
      data: {},
    });

    const result = await context.request.post(
      `/api/charges/${charge.id}/share-token`,
      { data: {} },
    );
    expect(result.status()).toBe(400);
  });
});
