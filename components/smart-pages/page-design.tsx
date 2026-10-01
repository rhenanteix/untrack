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
  return (
    <div
      className={`${styles.canvas} ${styles[theme.preset]}`}
      data-theme={theme.preset}
      style={
        {
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
      <div className={styles.art} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className={styles.content}>
        <header className={styles.profile}>
          {avatarUrl ? (
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
          )}
          {preview ? (
            <strong className={styles.title}>{title}</strong>
          ) : (
            <h1 className={styles.title}>{title}</h1>
          )}
          {description && <p>{description}</p>}
        </header>
        <div className={styles.links}>{children}</div>
        {socials && <div className={styles.socials}>{socials}</div>}
        <div className={styles.signature}>
          feito com <b>untrack</b>
          <span aria-hidden="true"> ↗</span>
        </div>
      </div>
    </div>
  );
}
