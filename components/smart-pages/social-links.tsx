"use client";

import type { CSSProperties } from "react";
import {
  getSocialProvider,
  type SocialProviderId,
} from "@/modules/social-providers";
import type { SmartPageTheme } from "@/modules/smart-pages/themes";
import { analytics } from "@/lib/client/analytics";
import styles from "./themes.module.css";

export type SmartPageSocialNetwork = SocialProviderId;

export type SmartPageSocialLink = {
  network: SmartPageSocialNetwork;
  url: string;
  label?: string;
};

export function PageSocialLinks({
  links,
  theme,
  label = "Redes sociais",
  slug,
}: {
  links: SmartPageSocialLink[];
  theme: SmartPageTheme;
  label?: string;
  slug?: string;
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
        const provider = getSocialProvider(link.network);
        if (!provider) return null;
        const Icon = provider.icon;
        const displayLabel = link.label || provider.name;
        return (
          <a
            key={link.network}
            href={link.url}
            target={link.network === "email" ? undefined : "_blank"}
            rel={link.network === "email" ? undefined : "noreferrer"}
            aria-label={
              displayLabel === provider.name
                ? provider.name
                : `${provider.name}: ${displayLabel}`
            }
            title={style === "icons" ? provider.name : undefined}
            data-network={link.network}
            onClick={() => {
              if (slug) void analytics.trackSmartPage("social_click", slug, link.network);
            }}
          >
            {style !== "text" && <Icon aria-hidden="true" />}
            {style !== "icons" && <span>{displayLabel}</span>}
          </a>
        );
      })}
    </nav>
  );
}
