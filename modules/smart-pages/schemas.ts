import { z } from "zod";
import { themeIds } from "./themes";
import { productBlockSettingsSchema } from "@/modules/products/schemas";
import {
  normalizeSocialUrl,
  socialProviderIds,
} from "@/modules/social-providers";
import { webUrlSchema } from "@/modules/validation/url-validation";

const reservedSlugs = new Set(["new", "api", "admin"]);
const socialLabelSchema = z
  .string()
  .trim()
  .min(1, "Informe um rótulo ou deixe o campo vazio.")
  .max(40, "Use no máximo 40 caracteres no rótulo.")
  .optional();

export const smartPageSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use pelo menos 3 caracteres no endereço.")
  .max(60, "Use no máximo 60 caracteres no endereço.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use letras de a a z, números e hífens entre palavras. Espaços, acentos, símbolos e hífens repetidos não são aceitos. Exemplo: ana-silva.",
  )
  .refine(
    (value) => !reservedSlugs.has(value),
    "Este endereço é reservado pelo sistema. Escolha outro, como ana-silva.",
  );

export const smartPageStatusSchema = z.enum(["draft", "published"]);

export const smartPageThemeSchema = z
  .object({
    preset: z.enum(themeIds).default("minimal"),
    avatarSize: z.number().int().min(48).max(144).optional(),
    titleSize: z.number().int().min(24).max(48).optional(),
    spacing: z.number().int().min(8).max(32).optional(),
    layout: z.enum(["card", "full"]).optional(),
    font: z
      .enum(["sans", "serif", "mono", "manrope", "georgia", "courier"])
      .optional(),
    alignment: z.enum(["center", "left"]).optional(),
    avatarShape: z.enum(["circle", "rounded", "square"]).optional(),
    buttonStyle: z.enum(["solid", "outline", "soft"]).optional(),
    photoLayout: z
      .enum(["classic", "hero", "banner", "cutout", "shape"])
      .optional(),
    logoUrl: webUrlSchema.optional(),
    titleStyle: z
      .enum(["classic", "editorial", "bold", "uppercase"])
      .optional(),
    wallpaper: z
      .enum(["fill", "gradient", "blur", "pattern", "image", "video"])
      .optional(),
    backgroundGradient: z
      .enum(["aurora", "sunset", "ocean", "orchid"])
      .optional(),
    backgroundPattern: z.enum(["dots", "grid", "lines", "waves"]).optional(),
    backgroundImageUrl: webUrlSchema.optional(),
    backgroundVideoUrl: webUrlSchema.optional(),
    sections: z
      .array(z.enum(["avatar", "title", "description", "links", "socials"]))
      .length(5)
      .refine(
        (items) => new Set(items).size === 5,
        "Cada seção deve aparecer uma única vez.",
      )
      .optional(),
    hiddenSections: z
      .array(z.enum(["avatar", "description", "socials"]))
      .max(3)
      .refine(
        (items) => new Set(items).size === items.length,
        "Seções repetidas.",
      )
      .optional(),
    socialStyle: z.enum(["icons", "icon-text", "text"]).optional(),
    socialShape: z.enum(["circle", "square", "rounded", "minimal"]).optional(),
    socialSize: z.enum(["small", "medium", "large"]).optional(),
    socialSpacing: z.enum(["compact", "normal", "wide"]).optional(),
    socialColor: z.enum(["auto", "theme", "brand", "custom"]).optional(),
    socialCustomColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    background: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    textColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    buttonColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    buttonRadius: z.number().int().min(0).max(28).optional(),
  })
  .strict();

const socialLinkSchema = z
  .object({
    network: z.enum(socialProviderIds),
    url: z.string().trim().min(1).max(4096),
    label: socialLabelSchema,
  })
  .strict()
  .superRefine((link, context) => {
    if (!normalizeSocialUrl(link.network, link.url)) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Informe um endereço válido para esta rede.",
      });
    }
  })
  .transform((link) => ({
    ...link,
    url: normalizeSocialUrl(link.network, link.url) ?? link.url,
  }));

export const socialLinksSchema = z
  .array(socialLinkSchema)
  .max(8)
  .superRefine((links, context) => {
    if (new Set(links.map((link) => link.network)).size !== links.length) {
      context.addIssue({
        code: "custom",
        message: "Cada rede pode ser informada apenas uma vez.",
      });
    }
  });

export const smartPageInputSchema = z
  .object({
    slug: smartPageSlugSchema,
    title: z.string().trim().min(1, "Informe um título.").max(120),
    description: z.string().trim().max(500).default(""),
    avatarUrl: webUrlSchema.nullable().optional(),
    theme: smartPageThemeSchema.default({ preset: "minimal" }),
    socialLinks: socialLinksSchema.default([]),
  })
  .strict();

export const smartPageUpdateSchema = smartPageInputSchema
  .omit({ slug: true })
  .extend({
    slug: smartPageSlugSchema.optional(),
    description: z.string().trim().max(500).optional(),
    avatarUrl: webUrlSchema.nullable().optional(),
    theme: smartPageThemeSchema.optional(),
    socialLinks: socialLinksSchema.optional(),
  })
  .partial()
  .strict();

export const linkBlockSettingsSchema = z
  .object({
    title: z.string().trim().min(1, "Informe um título.").max(120),
    destinationUrl: webUrlSchema.optional(),
    openInNewTab: z.boolean().default(true),
  })
  .strict();

const linkSmartPageBlockInputSchema = z
  .object({
    type: z.literal("link"),
    settings: linkBlockSettingsSchema,
    visible: z.boolean().default(true),
    analyticsEnabled: z.boolean().default(true),
    linkId: z.string().min(1).max(200).nullable().optional(),
  })
  .strict();

const productSmartPageBlockInputSchema = z
  .object({
    type: z.literal("product"),
    settings: productBlockSettingsSchema,
    visible: z.boolean().default(true),
    analyticsEnabled: z.boolean().default(true),
    productId: z.string().min(1).max(200),
  })
  .strict();

const settingsOnlyBlockBase = {
  visible: z.boolean().default(true),
  analyticsEnabled: z.boolean().default(true),
};

export const titleBlockSettingsSchema = z
  .object({
    text: z.string().trim().min(1).max(120),
    level: z.enum(["h2", "h3"]).default("h2"),
    alignment: z.enum(["left", "center", "right"]).default("center"),
  })
  .strict();
export const textBlockSettingsSchema = z
  .object({
    content: z.string().trim().min(1).max(1000),
    alignment: z.enum(["left", "center", "right"]).default("center"),
  })
  .strict();
export const dividerBlockSettingsSchema = z
  .object({ style: z.enum(["solid", "dashed", "dotted"]).default("solid") })
  .strict();
export const imageBlockSettingsSchema = z
  .object({
    imageUrl: webUrlSchema,
    alt: z.string().trim().max(160).default(""),
    destinationUrl: webUrlSchema.optional(),
  })
  .strict();

function isDomainOrSubdomain(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

function hasYoutubeVideoId(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!isDomainOrSubdomain(host, "youtube.com") && host !== "youtu.be")
      return false;
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : (url.searchParams.get("v") ??
          url.pathname.split("/").filter(Boolean).at(-1));
    return Boolean(id && /^[\w-]{6,}$/.test(id));
  } catch {
    return false;
  }
}

function hasSpotifyEmbedResource(value: string) {
  try {
    const url = new URL(value);
    if (!isDomainOrSubdomain(url.hostname.toLowerCase(), "spotify.com"))
      return false;
    const [kind, id] = url.pathname.split("/").filter(Boolean);
    return Boolean(
      id && ["track", "album", "playlist", "episode", "show"].includes(kind),
    );
  } catch {
    return false;
  }
}

export const videoBlockSettingsSchema = z
  .object({
    url: webUrlSchema.refine(hasYoutubeVideoId, "Use um endereço do YouTube."),
    title: z.string().trim().max(120).default("Vídeo"),
  })
  .strict();
export const spotifyBlockSettingsSchema = z
  .object({
    url: webUrlSchema.refine(
      hasSpotifyEmbedResource,
      "Use um link de faixa, álbum, playlist, episódio ou programa do Spotify.",
    ),
    title: z.string().trim().max(120).default("Spotify"),
  })
  .strict();
export const fileBlockSettingsSchema = z
  .object({ url: webUrlSchema, title: z.string().trim().min(1).max(120) })
  .strict();
export const qrBlockSettingsSchema = z
  .object({
    destinationUrl: webUrlSchema,
    title: z.string().trim().max(120).default("Escaneie o QR code"),
  })
  .strict();
export const whatsappBlockSettingsSchema = z
  .object({
    number: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,24}$/, "Informe um número de WhatsApp válido."),
    message: z.string().trim().max(500).default(""),
    label: z.string().trim().min(1).max(80).default("Falar no WhatsApp"),
  })
  .strict();
export const emailBlockSettingsSchema = z
  .object({
    address: z.string().trim().email("Informe um e-mail válido."),
    subject: z.string().trim().max(160).default(""),
    label: z.string().trim().min(1).max(80).default("Enviar e-mail"),
  })
  .strict();
export const phoneBlockSettingsSchema = z
  .object({
    number: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,24}$/, "Informe um telefone válido."),
    label: z.string().trim().min(1).max(80).default("Ligar"),
  })
  .strict();
export const eventBlockSettingsSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    date: z.string().trim().max(80).default(""),
    destinationUrl: webUrlSchema,
  })
  .strict();
export const appointmentBlockSettingsSchema = z
  .object({
    title: z.string().trim().min(1).max(120).default("Agendar um horário"),
    destinationUrl: webUrlSchema,
  })
  .strict();

const titleSmartPageBlockInputSchema = z
  .object({
    type: z.literal("title"),
    settings: titleBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const textSmartPageBlockInputSchema = z
  .object({
    type: z.literal("text"),
    settings: textBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const dividerSmartPageBlockInputSchema = z
  .object({
    type: z.literal("divider"),
    settings: dividerBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const imageSmartPageBlockInputSchema = z
  .object({
    type: z.literal("image"),
    settings: imageBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const videoSmartPageBlockInputSchema = z
  .object({
    type: z.literal("video"),
    settings: videoBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const spotifySmartPageBlockInputSchema = z
  .object({
    type: z.literal("spotify"),
    settings: spotifyBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const fileSmartPageBlockInputSchema = z
  .object({
    type: z.literal("file"),
    settings: fileBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const qrSmartPageBlockInputSchema = z
  .object({
    type: z.literal("qr"),
    settings: qrBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const whatsappSmartPageBlockInputSchema = z
  .object({
    type: z.literal("whatsapp"),
    settings: whatsappBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const emailSmartPageBlockInputSchema = z
  .object({
    type: z.literal("email"),
    settings: emailBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const phoneSmartPageBlockInputSchema = z
  .object({
    type: z.literal("phone"),
    settings: phoneBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const eventSmartPageBlockInputSchema = z
  .object({
    type: z.literal("event"),
    settings: eventBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();
const appointmentSmartPageBlockInputSchema = z
  .object({
    type: z.literal("appointment"),
    settings: appointmentBlockSettingsSchema,
    ...settingsOnlyBlockBase,
  })
  .strict();

export const smartPageBlockInputSchema = z
  .union([
    linkSmartPageBlockInputSchema,
    productSmartPageBlockInputSchema,
    titleSmartPageBlockInputSchema,
    textSmartPageBlockInputSchema,
    dividerSmartPageBlockInputSchema,
    imageSmartPageBlockInputSchema,
    videoSmartPageBlockInputSchema,
    spotifySmartPageBlockInputSchema,
    fileSmartPageBlockInputSchema,
    qrSmartPageBlockInputSchema,
    whatsappSmartPageBlockInputSchema,
    emailSmartPageBlockInputSchema,
    phoneSmartPageBlockInputSchema,
    eventSmartPageBlockInputSchema,
    appointmentSmartPageBlockInputSchema,
  ])
  .superRefine((value, context) => {
    if (
      value.type === "link" &&
      !value.linkId &&
      !value.settings.destinationUrl
    ) {
      context.addIssue({
        code: "custom",
        path: ["settings", "destinationUrl"],
        message: "Informe um destino ou selecione um link gerenciado.",
      });
    }
  });

export type SmartPageInput = z.infer<typeof smartPageInputSchema>;
export type SmartPageUpdate = z.infer<typeof smartPageUpdateSchema>;
export type SmartPageBlockInput = z.infer<typeof smartPageBlockInputSchema>;
