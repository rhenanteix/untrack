import type { CSSProperties, ReactNode } from "react";
import { readableInk, type SmartPageTheme } from "@/modules/smart-pages/themes";
import styles from "./themes.module.css";

/** One canvas for template thumbnails, live preview and published pages. */
export function PageDesign({
  title,
  description,
  avatarUrl,
  theme,
  children,
  socials,
  preview = false,
}: {
  title: string;
  description?: string;
  avatarUrl?: string | null;
  theme: SmartPageTheme;
  children: ReactNode;
  socials?: ReactNode;
  preview?: boolean;
}) {
  const wallpaperImage =
    (theme.wallpaper === "image" || theme.wallpaper === "blur") &&
    theme.backgroundImageUrl
      ? theme.backgroundImageUrl
      : undefined;
  const wallpaperVideo =
    theme.wallpaper === "video" && theme.backgroundVideoUrl
      ? theme.backgroundVideoUrl
      : undefined;
  const logo = theme.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={theme.logoUrl}
      alt={`Logo de ${title}`}
      width={56}
      height={56}
      referrerPolicy="no-referrer"
      className={styles.logo}
    />
  ) : null;
  const avatar = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      width={88}
      height={88}
      referrerPolicy="no-referrer"
      className={styles.avatar}
    />
  ) : (
    <span className={styles.avatar} aria-hidden="true">
      {title.slice(0, 1).toUpperCase()}
    </span>
  );
  const sections: Record<string, ReactNode> = {
    avatar,
    title: preview ? (
      <strong className={styles.title}>{title}</strong>
    ) : (
      <h1 className={styles.title}>{title}</h1>
    ),
    description: description ? (
      <p className={styles.bio}>{description}</p>
    ) : null,
    links: <div className={styles.links}>{children}</div>,
    socials: socials ? <div className={styles.socials}>{socials}</div> : null,
  };
  return (
    <div
      className={`${styles.canvas} ${styles[theme.preset]}`}
      data-theme={theme.preset}
      data-layout={theme.layout ?? "card"}
      data-font={theme.font}
      data-alignment={theme.alignment}
      data-avatar={theme.avatarShape}
      data-buttons={theme.buttonStyle}
      data-photo-layout={theme.photoLayout ?? "classic"}
      data-title-style={theme.titleStyle ?? "classic"}
      data-wallpaper={theme.wallpaper ?? "fill"}
      data-gradient={theme.backgroundGradient}
      data-pattern={theme.backgroundPattern}
      style={
        {
          "--avatar-size":
            theme.avatarSize === undefined
              ? undefined
              : `${theme.avatarSize}px`,
          "--title-size":
            theme.titleSize === undefined ? undefined : `${theme.titleSize}px`,
          "--spacing":
            theme.spacing === undefined ? undefined : `${theme.spacing}px`,
          "--bg": theme.background,
          "--ink": theme.textColor,
          "--button": theme.buttonColor,
          "--button-ink": theme.buttonColor
            ? readableInk(theme.buttonColor)
            : undefined,
          "--radius":
            theme.buttonRadius === undefined
              ? undefined
              : `${theme.buttonRadius}px`,
        } as CSSProperties
      }
    >
      {wallpaperImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={wallpaperImage}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className={styles.wallpaperImage}
        />
      )}
      {wallpaperVideo && (
        <video
          className={styles.wallpaperVideo}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          src={wallpaperVideo}
        />
      )}
      {(wallpaperImage || wallpaperVideo) && (
        <div className={styles.wallpaperOverlay} aria-hidden="true" />
      )}
      <div className={styles.art} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className={styles.content}>
        {logo && <div className={styles.logoWrap}>{logo}</div>}
        {(
          theme.sections ?? [
            "avatar",
            "title",
            "description",
            "links",
            "socials",
          ]
        )
          .filter(
            (section) =>
              !theme.hiddenSections?.includes(
                section as "avatar" | "description" | "socials",
              ),
          )
          .map((section) =>
            sections[section] ? (
              <div
                key={section}
                className={styles.section}
                data-section={section}
              >
                {sections[section]}
              </div>
            ) : null,
          )}
        <div className={styles.signature}>
          feito com <b>LinkOr</b>
          <span aria-hidden="true"> ↗</span>
        </div>
      </div>
    </div>
  );
}
