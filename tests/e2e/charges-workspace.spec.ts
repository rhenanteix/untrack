import { test, expect, type APIRequestContext } from "@playwright/test";
import { grantTestPremium, testDatabase } from "../helpers/premium";
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
      name: "Charge UX",
      email: `charge-ux-${randomUUID()}@example.com`,
      password: "Uma senha forte para teste! 2026",
    },
  });
  expect(result.status(), await result.text()).toBe(200);
  const workspace = await (await request.get(`${baseURL}/api/workspaces`)).json();
  await grantTestPremium(workspace.activeId);
}

test.describe("LinkOr Pay charges", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await register(context.request, baseURL!);
  });

  test("creates, edits, and cancels a charge", async ({ page }) => {
    await page.goto("/untrack/pay");
    await expect(page.locator("h1")).toHaveText("Cobranças");

    await page.getByRole("button", { name: /Nova cobrança/ }).click();
    await page.getByLabel("Descrição").fill("Taxa de inscrição");
    await page.getByLabel("Valor (centavos)").fill("5000");
    await page.getByRole("button", { name: "Criar" }).click();

    await expect(page.locator(".pay-card")).toHaveCount(1);
    await expect(page.locator(".pay-card .pay-status-badge")).toHaveText(
      "Rascunho",
    );

    const editButton = page.locator(".pay-actions button[title='Editar']");
    await editButton.click();

    await page.locator(".pay-edit-form input[maxlength]").fill("Taxa de inscrição atualizada");
    await page.locator(".pay-edit-form input[type='number']").fill("6000");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.locator(".pay-amount")).toHaveText("R$ 60,00");

    const cancelButton = page.locator(".pay-actions button[title='Cancelar']");
    await cancelButton.click();

    await expect(page.locator(".pay-status-badge")).toHaveText("Cancelado");
    await expect(page.locator(".pay-card")).toHaveCount(0);
  });

  test("cannot edit a non-draft charge", async ({ page }) => {
    await page.goto("/untrack/pay");
    await page.getByRole("button", { name: /Nova cobrança/ }).click();
    await page.getByLabel("Descrição").fill("Cobrança teste");
    await page.getByLabel("Valor (centavos)").fill("1000");
    await page.getByRole("button", { name: "Criar" }).click();

    const activateButton = page.locator(".pay-actions button[title='Ativar cobrança']");
    await activateButton.click();
    await expect(page.locator(".pay-status-badge")).toHaveText("Pendente");
    await expect(page.locator(".pay-actions button[title='Editar']")).toHaveCount(0);
  });

  test("isolates charges between workspaces", async ({ page, context, baseURL }) => {
    const userEmail = `iso-ux-${randomUUID()}@example.com`;
    await testDatabase(async (db) => {
      const userId = randomUUID();
      await db.user.create({
        data: {
          id: userId,
          email: userEmail,
          name: "Isolation Test",
          plan: "premium",
          emailVerified: true,
        },
      });
      await db.workspace.create({
        data: {
          id: `personal:${userId}`,
          name: "Meu workspace",
          members: { create: { userId, role: "owner" } },
          usage: { create: { resource: "members", count: 1 } },
        },
      });

      const result = await context.request.post("/api/auth/sign-up/email", {
        headers: {
          origin: baseURL!,
          "x-real-ip": `198.18.${Math.floor(Math.random() * 240)}.5`,
        },
        data: {
          name: "Isolation Test",
          email: userEmail,
          password: "Uma senha forte para teste! 2026",
        },
      });
      expect(result.status(), await result.text()).toBe(200);

      const workspace = await (
        await context.request.get(`${baseURL}/api/workspaces`)
      ).json();
      await grantTestPremium(workspace.activeId);

      await db.charge.create({
        data: {
          workspaceId: userId,
          description: "Cobrança secreta",
          amountInCents: 999,
          status: "draft",
        },
      });
      return userId;
    });

    await page.goto("/untrack/pay");
    await expect(page.locator(".pay-card .pay-description")).toHaveText(
      "Taxa de inscrição",
    );
    await expect(page.locator("text=Cobrança secreta")).toHaveCount(0);
  });
});
