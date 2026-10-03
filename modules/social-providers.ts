import type { IconType } from "react-icons";
import {
  FaBehance,
  FaDiscord,
  FaDribbble,
  FaEnvelope,
  FaFacebookF,
  FaGithub,
  FaGlobe,
  FaInstagram,
  FaLinkedinIn,
  FaMedium,
  FaPinterestP,
  FaSnapchat,
  FaSpotify,
  FaTelegram,
  FaThreads,
  FaTiktok,
  FaTwitch,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";

export const socialProviderIds = [
  "instagram",
  "linkedin",
  "whatsapp",
  "youtube",
  "tiktok",
  "facebook",
  "x",
  "github",
  "threads",
  "pinterest",
  "snapchat",
  "telegram",
  "spotify",
  "twitch",
  "discord",
  "behance",
  "dribbble",
  "medium",
  "website",
  "email",
] as const;

export type SocialProviderId = (typeof socialProviderIds)[number];
export type SocialProviderCategory =
  "social" | "professional" | "messaging" | "media" | "portfolio" | "contact";

type SocialProviderDefinition = {
  name: string;
  icon: IconType;
  urlPattern: string;
  placeholder: string;
  category: SocialProviderCategory;
  hosts?: readonly string[];
  handleBase?: string;
};

export type SocialProvider = SocialProviderDefinition & {
  id: SocialProviderId;
  validation: (value: string) => boolean;
};

const definitions: Record<SocialProviderId, SocialProviderDefinition> = {
  instagram: {
    name: "Instagram",
    icon: FaInstagram,
    urlPattern: "@usuario ou instagram.com/usuario",
    placeholder: "@linkor",
    category: "social",
    hosts: ["instagram.com"],
    handleBase: "https://instagram.com/",
  },
  linkedin: {
    name: "LinkedIn",
    icon: FaLinkedinIn,
    urlPattern: "linkedin.com/in/usuario",
    placeholder: "linkedin.com/in/linkor",
    category: "professional",
    hosts: ["linkedin.com"],
  },
  whatsapp: {
    name: "WhatsApp",
    icon: FaWhatsapp,
    urlPattern: "+5511999999999 ou wa.me/5511999999999",
    placeholder: "+55 11 99999-9999",
    category: "messaging",
    hosts: ["wa.me", "whatsapp.com"],
  },
  youtube: {
    name: "YouTube",
    icon: FaYoutube,
    urlPattern: "youtube.com/@canal",
    placeholder: "youtube.com/@linkor",
    category: "media",
    hosts: ["youtube.com", "youtu.be"],
  },
  tiktok: {
    name: "TikTok",
    icon: FaTiktok,
    urlPattern: "@usuario ou tiktok.com/@usuario",
    placeholder: "@linkor",
    category: "social",
    hosts: ["tiktok.com"],
    handleBase: "https://tiktok.com/@",
  },
  facebook: {
    name: "Facebook",
    icon: FaFacebookF,
    urlPattern: "facebook.com/pagina",
    placeholder: "facebook.com/linkor",
    category: "social",
    hosts: ["facebook.com"],
  },
  x: {
    name: "X",
    icon: FaXTwitter,
    urlPattern: "@usuario ou x.com/usuario",
    placeholder: "@linkor",
    category: "social",
    hosts: ["x.com", "twitter.com"],
    handleBase: "https://x.com/",
  },
  github: {
    name: "GitHub",
    icon: FaGithub,
    urlPattern: "github.com/usuario",
    placeholder: "github.com/linkor",
    category: "professional",
    hosts: ["github.com"],
  },
  threads: {
    name: "Threads",
    icon: FaThreads,
    urlPattern: "threads.com/@usuario",
    placeholder: "threads.com/@linkor",
    category: "social",
    hosts: ["threads.com"],
  },
  pinterest: {
    name: "Pinterest",
    icon: FaPinterestP,
    urlPattern: "pinterest.com/usuario",
    placeholder: "pinterest.com/linkor",
    category: "social",
    hosts: ["pinterest.com"],
  },
  snapchat: {
    name: "Snapchat",
    icon: FaSnapchat,
    urlPattern: "snapchat.com/add/usuario",
    placeholder: "snapchat.com/add/linkor",
    category: "social",
    hosts: ["snapchat.com"],
  },
  telegram: {
    name: "Telegram",
    icon: FaTelegram,
    urlPattern: "t.me/usuario",
    placeholder: "t.me/linkor",
    category: "messaging",
    hosts: ["t.me", "telegram.me"],
  },
  spotify: {
    name: "Spotify",
    icon: FaSpotify,
    urlPattern: "open.spotify.com/...",
    placeholder: "open.spotify.com/artist/...",
    category: "media",
    hosts: ["spotify.com"],
  },
  twitch: {
    name: "Twitch",
    icon: FaTwitch,
    urlPattern: "twitch.tv/canal",
    placeholder: "twitch.tv/linkor",
    category: "media",
    hosts: ["twitch.tv"],
  },
  discord: {
    name: "Discord",
    icon: FaDiscord,
    urlPattern: "discord.gg/convite",
    placeholder: "discord.gg/linkor",
    category: "messaging",
    hosts: ["discord.gg", "discord.com"],
  },
  behance: {
    name: "Behance",
    icon: FaBehance,
    urlPattern: "behance.net/usuario",
    placeholder: "behance.net/linkor",
    category: "portfolio",
    hosts: ["behance.net"],
  },
  dribbble: {
    name: "Dribbble",
    icon: FaDribbble,
    urlPattern: "dribbble.com/usuario",
    placeholder: "dribbble.com/linkor",
    category: "portfolio",
    hosts: ["dribbble.com"],
  },
  medium: {
    name: "Medium",
    icon: FaMedium,
    urlPattern: "medium.com/@usuario",
    placeholder: "medium.com/@linkor",
    category: "media",
    hosts: ["medium.com"],
  },
  website: {
    name: "Website",
    icon: FaGlobe,
    urlPattern: "https://seusite.com",
    placeholder: "https://linkor.com",
    category: "contact",
  },
  email: {
    name: "E-mail",
    icon: FaEnvelope,
    urlPattern: "voce@empresa.com ou mailto:voce@empresa.com",
    placeholder: "voce@empresa.com",
    category: "contact",
  },
};

function urlWithProtocol(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function matchesHost(hostname: string, hosts: readonly string[]) {
  return hosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

export function normalizeSocialUrl(
  providerId: SocialProviderId,
  input: string,
) {
  const value = input.trim();
  const provider = definitions[providerId];
  if (!value) return null;

  if (providerId === "email") {
    const email = value.replace(/^mailto:/i, "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : null;
  }

  if (providerId === "whatsapp" && /^\+?[0-9 ()-]{7,24}$/.test(value)) {
    const phone = value.replace(/\D/g, "");
    return `https://wa.me/${phone}`;
  }

  const withHandle =
    provider.handleBase && value.startsWith("@")
      ? `${provider.handleBase}${value.slice(1)}`
      : value;
  try {
    const url = new URL(urlWithProtocol(withHandle));
    if (
      !["http:", "https:"].includes(url.protocol) ||
      (provider.hosts && !matchesHost(url.hostname, provider.hosts))
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export const socialProviders = socialProviderIds.map((id) => ({
  id,
  ...definitions[id],
  validation: (value: string) => normalizeSocialUrl(id, value) !== null,
}));

export function getSocialProvider(id: SocialProviderId) {
  return socialProviders.find((provider) => provider.id === id);
}
