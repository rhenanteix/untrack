import {
  appointmentBlockSettingsSchema,
  dividerBlockSettingsSchema,
  emailBlockSettingsSchema,
  eventBlockSettingsSchema,
  fileBlockSettingsSchema,
  imageBlockSettingsSchema,
  phoneBlockSettingsSchema,
  qrBlockSettingsSchema,
  spotifyBlockSettingsSchema,
  textBlockSettingsSchema,
  titleBlockSettingsSchema,
  videoBlockSettingsSchema,
  whatsappBlockSettingsSchema,
} from "@/modules/smart-pages/schemas";

export const richBlockTypes = [
  "title",
  "text",
  "divider",
  "image",
  "video",
  "spotify",
  "file",
  "qr",
  "whatsapp",
  "email",
  "phone",
  "event",
  "appointment",
] as const;

export type RichBlockType = (typeof richBlockTypes)[number];
export type RichBlockSettings = Record<string, string>;

export function isRichBlockType(value: string): value is RichBlockType {
  return richBlockTypes.includes(value as RichBlockType);
}

export function parseRichBlockSettings(
  type: RichBlockType,
  settings: unknown,
): RichBlockSettings | null {
  const schema =
    type === "title"
      ? titleBlockSettingsSchema
      : type === "text"
        ? textBlockSettingsSchema
        : type === "divider"
          ? dividerBlockSettingsSchema
          : type === "image"
            ? imageBlockSettingsSchema
            : type === "video"
              ? videoBlockSettingsSchema
              : type === "spotify"
                ? spotifyBlockSettingsSchema
                : type === "file"
                  ? fileBlockSettingsSchema
                  : type === "qr"
                    ? qrBlockSettingsSchema
                    : type === "whatsapp"
                      ? whatsappBlockSettingsSchema
                      : type === "email"
                        ? emailBlockSettingsSchema
                        : type === "phone"
                          ? phoneBlockSettingsSchema
                          : type === "event"
                            ? eventBlockSettingsSchema
                            : appointmentBlockSettingsSchema;
  const result = schema.safeParse(settings);
  return result.success ? (result.data as RichBlockSettings) : null;
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function richBlockHref(
  type: RichBlockType,
  settings: RichBlockSettings,
) {
  if (type === "image") return settings.destinationUrl || null;
  if (type === "file" || type === "event" || type === "appointment")
    return settings.url ?? settings.destinationUrl ?? null;
  if (type === "whatsapp") {
    const message = settings.message
      ? `?text=${encodeURIComponent(settings.message)}`
      : "";
    return `https://wa.me/${digits(settings.number ?? "")}${message}`;
  }
  if (type === "email") {
    const subject = settings.subject
      ? `?subject=${encodeURIComponent(settings.subject)}`
      : "";
    return `mailto:${settings.address ?? ""}${subject}`;
  }
  if (type === "phone") return `tel:${digits(settings.number ?? "")}`;
  return null;
}

export function youtubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const id =
      url.hostname.toLowerCase() === "youtu.be"
        ? url.pathname.slice(1)
        : (url.searchParams.get("v") ??
          url.pathname.split("/").filter(Boolean).at(-1));
    return id && /^[\w-]{6,}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`
      : null;
  } catch {
    return null;
  }
}

export function spotifyEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname.split("/").filter(Boolean);
    const [kind, id] = path;
    return ["track", "album", "playlist", "episode", "show"].includes(kind) &&
      id
      ? `https://open.spotify.com/embed/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`
      : null;
  } catch {
    return null;
  }
}
