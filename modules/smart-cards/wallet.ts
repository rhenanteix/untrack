import { randomUUID } from "node:crypto";
import { JWT } from "google-auth-library";
import { PKPass } from "passkit-generator";
import sharp from "sharp";
import { ApiError } from "@/lib/api-response";
import { appUrl } from "@/lib/app-url";
import { getPrisma } from "@/lib/prisma";
import { ensureSmartCardQr, getSmartCard } from "@/modules/smart-cards/service";
import {
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";
import {
  appleWalletConfiguration,
  appleWalletCredentials,
  googleWalletConfiguration,
  googleWalletCredentials,
  walletCanIssue,
  walletConfiguration,
  type WalletProvider,
} from "./wallet-config";

type WalletCard = {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  headline: string;
  company: string;
  bio: string;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  contactPoints: unknown;
  theme: unknown;
  qrAsset: { encodedUrl: string } | null;
};

type WalletPassRecord = {
  id: string;
  provider: WalletProvider;
  serialNumber: string | null;
  externalObjectId: string | null;
};

type GoogleWalletObject = {
  id: string;
  classId: string;
  genericType: "GENERIC_OTHER";
  cardTitle: { defaultValue: { language: string; value: string } };
  header: { defaultValue: { language: string; value: string } };
  subheader?: { defaultValue: { language: string; value: string } };
  hexBackgroundColor?: string;
  barcode: { type: "QR_CODE"; value: string };
  logo?: { sourceUri: { uri: string } };
  textModulesData?: { id: string; header: string; body: string }[];
  linksModuleData: {
    uris: { id: string; uri: string; description: string }[];
  };
};

function fullName(card: WalletCard) {
  return `${card.firstName} ${card.lastName}`.trim();
}

function cardUrl(card: WalletCard) {
  return new URL(`/c/${encodeURIComponent(card.slug)}`, appUrl()).href;
}

function themeColor(theme: unknown, key: "background" | "textColor", fallback: string) {
  if (
    typeof theme !== "object" ||
    theme === null ||
    !(key in theme) ||
    typeof (theme as Record<string, unknown>)[key] !== "string"
  ) {
    return fallback;
  }
  const value = (theme as Record<string, string>)[key];
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function rgb(hex: string) {
  const value = hex.slice(1);
  return `rgb(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(
    value.slice(2, 4),
    16,
  )}, ${Number.parseInt(value.slice(4, 6), 16)})`;
}

function publicImageUrl(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function contactLines(card: WalletCard) {
  const lines = [
    ...(card.email ? [`E-mail: ${card.email}`] : []),
    ...(card.phone ? [`Telefone: ${card.phone}`] : []),
  ];
  if (!Array.isArray(card.contactPoints)) return lines;
  for (const point of card.contactPoints) {
    if (
      typeof point !== "object" ||
      point === null ||
      typeof (point as Record<string, unknown>).value !== "string"
    ) {
      continue;
    }
    const value = (point as Record<string, string>).value;
    if (!lines.some((line) => line.endsWith(value))) lines.push(value);
  }
  return lines;
}

async function iconBuffers(color: string) {
  const sizes = [29, 58, 87];
  const buffers = await Promise.all(
    sizes.map((size) =>
      sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: color,
        },
      })
        .png()
        .toBuffer(),
    ),
  );
  return {
    "icon.png": buffers[0],
    "icon@2x.png": buffers[1],
    "icon@3x.png": buffers[2],
  };
}

export class AppleWalletService {
  async createPass(card: WalletCard, serialNumber: string) {
    const configuration = appleWalletConfiguration();
    if (!walletCanIssue(configuration)) {
      throw new ApiError(409, "APPLE_WALLET_NOT_READY", configuration.message);
    }
    if (!card.qrAsset) {
      throw new ApiError(
        409,
        "SMART_CARD_QR_REQUIRED",
        "Gere o QR rastreável antes de emitir o passe.",
      );
    }
    const credentials = appleWalletCredentials();
    const background = themeColor(card.theme, "background", "#1f5a45");
    const foreground = themeColor(card.theme, "textColor", "#ffffff");
    const pass = new PKPass(
      await iconBuffers(background),
      {
        wwdr: credentials.wwdrCertificate,
        signerCert: credentials.signerCertificate,
        signerKey: credentials.signerKey,
        signerKeyPassphrase: credentials.signerKeyPassphrase,
      },
      {
        formatVersion: 1,
        passTypeIdentifier: credentials.passTypeIdentifier,
        teamIdentifier: credentials.teamIdentifier,
        serialNumber,
        organizationName: credentials.organizationName,
        description: `Cartão profissional de ${fullName(card)}`,
        logoText: card.company || "LinkOr",
        backgroundColor: rgb(background),
        foregroundColor: rgb(foreground),
        labelColor: rgb(foreground),
      },
    );
    pass.type = "generic";
    pass.primaryFields.push({ key: "name", label: "PROFISSIONAL", value: fullName(card) });
    if (card.headline) {
      pass.secondaryFields.push({ key: "headline", label: "CARGO", value: card.headline });
    }
    if (card.company) {
      pass.secondaryFields.push({ key: "company", label: "EMPRESA", value: card.company });
    }
    if (card.websiteUrl) {
      pass.auxiliaryFields.push({ key: "website", label: "SITE", value: card.websiteUrl });
    }
    pass.backFields.push(
      { key: "smart-card", label: "Smart Card", value: cardUrl(card) },
      ...contactLines(card).map((value, index) => ({
        key: `contact-${index}`,
        label: "CONTATO",
        value,
      })),
    );
    pass.setBarcodes({
      format: "PKBarcodeFormatQR",
      message: card.qrAsset.encodedUrl,
      messageEncoding: "iso-8859-1",
      altText: "Abrir Smart Card",
    });
    return pass;
  }

  async signPass(pass: PKPass) {
    return pass.getAsBuffer();
  }

  async generatePkpass(card: WalletCard, serialNumber: string) {
    return this.signPass(await this.createPass(card, serialNumber));
  }

  async updatePass(card: WalletCard, serialNumber: string) {
    return this.generatePkpass(card, serialNumber);
  }
}

export class GoogleWalletService {
  private client() {
    const credentials = googleWalletCredentials();
    return new JWT({
      email: credentials.serviceAccountEmail,
      key: credentials.privateKey,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
  }

  private classId() {
    return `${googleWalletCredentials().issuerId}.linkor.smart-card`;
  }

  private async request(
    method: "POST" | "PUT" | "PATCH",
    path: string,
    data: Record<string, unknown>,
  ) {
    const response = await this.client().request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/${path}`,
      method,
      data,
    });
    return response.data;
  }

  private isConflict(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      (("code" in error && (error as { code?: number }).code === 409) ||
        ("response" in error &&
          (error as { response?: { status?: number } }).response?.status ===
            409))
    );
  }

  async createClass() {
    const configuration = googleWalletConfiguration();
    if (!walletCanIssue(configuration)) {
      throw new ApiError(409, "GOOGLE_WALLET_NOT_READY", configuration.message);
    }
    const id = this.classId();
    try {
      await this.request("POST", "genericClass", { id });
    } catch (error) {
      if (!this.isConflict(error)) throw error;
    }
    return id;
  }

  buildObject(card: WalletCard, objectId: string): GoogleWalletObject {
    if (!card.qrAsset) {
      throw new ApiError(
        409,
        "SMART_CARD_QR_REQUIRED",
        "Gere o QR rastreável antes de emitir o passe.",
      );
    }
    const logoUrl = publicImageUrl(card.logoUrl);
    const contacts = contactLines(card);
    return {
      id: objectId,
      classId: this.classId(),
      genericType: "GENERIC_OTHER",
      cardTitle: {
        defaultValue: { language: "pt-BR", value: card.company || "LinkOr" },
      },
      header: {
        defaultValue: { language: "pt-BR", value: fullName(card) },
      },
      ...(card.headline
        ? {
            subheader: {
              defaultValue: { language: "pt-BR", value: card.headline },
            },
          }
        : {}),
      hexBackgroundColor: themeColor(card.theme, "background", "#1f5a45"),
      barcode: { type: "QR_CODE", value: card.qrAsset.encodedUrl },
      ...(logoUrl ? { logo: { sourceUri: { uri: logoUrl } } } : {}),
      ...(contacts.length
        ? {
            textModulesData: [
              { id: "contact", header: "Contato", body: contacts.join("\n") },
            ],
          }
        : {}),
      linksModuleData: {
        uris: [
          {
            id: "smart-card",
            uri: cardUrl(card),
            description: "Abrir Smart Card",
          },
        ],
      },
    };
  }

  async createObject(card: WalletCard, objectId: string) {
    const object = this.buildObject(card, objectId);
    try {
      await this.request("POST", "genericObject", object);
    } catch (error) {
      if (!this.isConflict(error)) throw error;
      await this.updateObject(card, objectId);
    }
    return object;
  }

  async updateObject(card: WalletCard, objectId: string) {
    const object = this.buildObject(card, objectId);
    await this.request(
      "PUT",
      `genericObject/${encodeURIComponent(objectId)}`,
      object,
    );
    return object;
  }

  async invalidateObject(objectId: string) {
    await this.request(
      "PATCH",
      `genericObject/${encodeURIComponent(objectId)}`,
      { state: "INACTIVE" },
    );
  }

  async generateSaveUrl(objectId: string) {
    const configuration = googleWalletConfiguration();
    if (!walletCanIssue(configuration)) {
      throw new ApiError(409, "GOOGLE_WALLET_NOT_READY", configuration.message);
    }
    const credentials = googleWalletCredentials();
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss: credentials.serviceAccountEmail,
        aud: "google",
        typ: "savetowallet",
        origins: [appUrl().origin],
        payload: { genericObjects: [{ id: objectId }] },
      }),
    ).toString("base64url");
    const { createSign } = await import("node:crypto");
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${payload}`);
    signer.end();
    const signature = signer.sign(credentials.privateKey).toString("base64url");
    return `https://pay.google.com/gp/v/save/${header}.${payload}.${signature}`;
  }

  async managePass(card: WalletCard, objectId: string) {
    await this.createClass();
    await this.createObject(card, objectId);
    return this.generateSaveUrl(objectId);
  }
}

export const appleWalletService = new AppleWalletService();
export const googleWalletService = new GoogleWalletService();

async function setPassPending(
  actor: Actor,
  card: WalletCard,
  provider: WalletProvider,
) {
  return workspaceTransaction(actor, "write", (tx) =>
    tx.smartCardWalletPass.upsert({
      where: { smartCardId_provider: { smartCardId: card.id, provider } },
      create: {
        workspaceId: actor.workspaceId,
        smartCardId: card.id,
        provider,
        serialNumber: provider === "apple" ? `linkor-${card.id}` : null,
      },
      update: { status: "pending_sync", lastError: null },
    }),
  );
}

async function markPassSynced(
  actor: Actor,
  passId: string,
  externalObjectId?: string,
) {
  return workspaceTransaction(actor, "write", (tx) =>
    tx.smartCardWalletPass.update({
      where: { id: passId },
      data: {
        status: "synced",
        externalObjectId,
        issuedAt: new Date(),
        lastSyncedAt: new Date(),
        lastError: null,
      },
    }),
  );
}

async function markPassFailed(actor: Actor, passId: string, error: unknown) {
  const message =
    error instanceof Error ? error.message.slice(0, 1000) : "Falha ao sincronizar.";
  await workspaceTransaction(actor, "write", (tx) =>
    tx.smartCardWalletPass.update({
      where: { id: passId },
      data: { status: "sync_failed", lastError: message },
    }),
  );
}

export async function issueSmartCardWalletPass(
  actor: Actor,
  smartCardId: string,
  provider: WalletProvider,
) {
  const configuration = walletConfiguration(provider);
  if (!walletCanIssue(configuration)) {
    throw new ApiError(409, "WALLET_NOT_READY", configuration.message);
  }
  await ensureSmartCardQr(actor, smartCardId);
  const card = await getSmartCard(actor, smartCardId);
  if (card.status !== "published") {
    throw new ApiError(
      409,
      "SMART_CARD_NOT_PUBLISHED",
      "Publique o Smart Card antes de emitir o passe.",
    );
  }
  const pass = await setPassPending(actor, card, provider);
  try {
    if (provider === "apple") {
      const serialNumber = pass.serialNumber ?? `linkor-${card.id}`;
      await appleWalletService.generatePkpass(card, serialNumber);
      await markPassSynced(actor, pass.id);
      return { provider, status: "synced" as const };
    }
    const objectId =
      pass.externalObjectId ??
      `${googleWalletCredentials().issuerId}.linkor-${card.id}`;
    const saveUrl = await googleWalletService.managePass(card, objectId);
    await markPassSynced(actor, pass.id, objectId);
    return { provider, status: "synced" as const, saveUrl };
  } catch (error) {
    await markPassFailed(actor, pass.id, error);
    throw error;
  }
}

export async function smartCardWalletStatus(actor: Actor, smartCardId: string) {
  const card = await getSmartCard(actor, smartCardId);
  return {
    cardId: card.id,
    providers: (["apple", "google"] as const).map((provider) => ({
      ...walletConfiguration(provider),
      pass:
        card.walletPasses.find((item) => item.provider === provider) ?? null,
    })),
  };
}

export async function revokeSmartCardWalletPass(
  actor: Actor,
  smartCardId: string,
  provider: WalletProvider,
) {
  const card = await getSmartCard(actor, smartCardId);
  const pass = card.walletPasses.find((item) => item.provider === provider);
  if (!pass) {
    throw new ApiError(404, "WALLET_PASS_NOT_FOUND", "Passe não encontrado.");
  }
  if (provider === "google" && pass.externalObjectId) {
    await googleWalletService.invalidateObject(pass.externalObjectId);
  }
  await workspaceTransaction(actor, "write", (tx) =>
    tx.smartCardWalletPass.update({
      where: { id: pass.id },
      data: { status: "revoked", lastError: null },
    }),
  );
}

export async function publicAppleWalletPass(slug: string) {
  const card = await getPrisma().smartCard.findFirst({
    where: { slug, status: "published" },
    include: {
      qrAsset: { select: { encodedUrl: true } },
      walletPasses: { where: { provider: "apple", status: "synced" } },
    },
  });
  const pass = card?.walletPasses[0];
  if (!card || !pass?.serialNumber) {
    throw new ApiError(404, "APPLE_WALLET_PASS_NOT_FOUND", "Passe não disponível.");
  }
  return appleWalletService.updatePass(card, pass.serialNumber);
}

export async function publicGoogleWalletSaveUrl(slug: string) {
  const card = await getPrisma().smartCard.findFirst({
    where: { slug, status: "published" },
    include: {
      walletPasses: { where: { provider: "google", status: "synced" } },
    },
  });
  const pass = card?.walletPasses[0];
  if (!card || !pass?.externalObjectId) {
    throw new ApiError(404, "GOOGLE_WALLET_PASS_NOT_FOUND", "Passe não disponível.");
  }
  return googleWalletService.generateSaveUrl(pass.externalObjectId);
}