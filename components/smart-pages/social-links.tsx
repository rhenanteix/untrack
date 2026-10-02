import type { CSSProperties } from "react";
import type { IconType } from "react-icons";
import {
  FaEnvelope,
  FaFacebookF,
  FaGlobe,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import type { SmartPageTheme } from "@/modules/smart-pages/themes";
import styles from "./themes.module.css";

export type SmartPageSocialNetwork =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "x"
  | "facebook"
  | "whatsapp"
  | "website"
  | "email";

export type SmartPageSocialLink = {
  network: SmartPageSocialNetwork;
  url: string;
  label?: string;
};

const networks: Record<SmartPageSocialNetwork, { label: string; Icon: IconType }> = {
  instagram: { label: "Instagram", Icon: FaInstagram },
  tiktok: { label: "TikTok", Icon: FaTiktok },
  youtube: { label: "YouTube", Icon: FaYoutube },
  linkedin: { label: "LinkedIn", Icon: FaLinkedinIn },
  x: { label: "X", Icon: FaXTwitter },
  facebook: { label: "Facebook", Icon: FaFacebookF },
  whatsapp: { label: "WhatsApp", Icon: FaWhatsapp },
  website: { label: "Site", Icon: FaGlobe },
  email: { label: "E-mail", Icon: FaEnvelope },
};

export function PageSocialLinks({
  links,
  theme,
  label = "Redes sociais",
}: {
  links: SmartPageSocialLink[];
  theme: SmartPageTheme;
  label?: string;
}) {
  const style = theme.socialStyle ?? "icons";
  const color = theme.socialColor ?? "auto";

  return (
    <nav
      className={styles.socialNav}
      aria-label={label}
      data-style={style}
      data-shape={theme.socialShape ?? "circle"}
      data-size={theme.socialSize ?? "medium"}
      data-spacing={theme.socialSpacing ?? "normal"}
      data-color={color}
      style={
        color === "custom" && theme.socialCustomColor
          ? ({ "--social-custom": theme.socialCustomColor } as CSSProperties)
          : undefined
      }
    >
      {links.map((link) => {
        const network = networks[link.network];
        const Icon = network.Icon;
        const displayLabel = link.label || network.label;
        return (
          <a
            key={link.network}
            href={link.url}
            target={link.network === "email" ? undefined : "_blank"}
            rel={link.network === "email" ? undefined : "noreferrer"}
            aria-label={
              displayLabel === network.label
                ? network.label
                : `${network.label}: ${displayLabel}`
            }
            title={style === "icons" ? network.label : undefined}
            data-network={link.network}
          >
            {style !== "text" && <Icon aria-hidden="true" />}
            {style !== "icons" && <span>{displayLabel}</span>}
          </a>
        );
      })}
    </nav>
  );
}
