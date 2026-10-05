"use client";

import { PageDesign } from "@/components/smart-pages/page-design";
import {
  isRichBlockType,
  parseRichBlockSettings,
  richBlockHref,
  spotifyEmbedUrl,
  youtubeEmbedUrl,
} from "@/components/smart-pages/rich-block";
import {
  PageSocialLinks,
  type SmartPageSocialLink,
} from "@/components/smart-pages/social-links";
import type { SmartPageTheme } from "@/modules/smart-pages/themes";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { SmartPageContentBlock } from "./content-block";
import { SmartPageForm } from "../public-form";
import styles from "../themes.module.css";

export interface SmartPagePreviewData {
  title: string;
  description: string;
  avatarUrl: string | null;
  theme: SmartPageTheme;
  socialLinks: SmartPageSocialLink[];
  blocks: SmartPageContentBlock[];
}

function PreviewQr({
  destinationUrl,
  title,
}: {
  destinationUrl: string;
  title: string;
}) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(destinationUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 300,
    }).then((nextDataUrl) => {
      if (!cancelled) setDataUrl(nextDataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [destinationUrl]);

  return (
    <div className={styles.richQr}>
      {dataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt={`QR Code: ${title}`} />
      )}
      <span>{title}</span>
    </div>
  );
}

function PreviewRichBlock({ block }: { block: SmartPageContentBlock }) {
  if (!isRichBlockType(block.type)) return null;
  const settings = parseRichBlockSettings(block.type, block.settings);
  if (!settings) return null;
  if (block.type === "title") {
    const Tag = settings.level === "h3" ? "h3" : "h2";
    return (
      <Tag
        className={styles.richTitle}
        data-alignment={settings.alignment ?? "center"}
      >
        {settings.text}
      </Tag>
    );
  }
  if (block.type === "text")
    return (
      <p
        className={styles.richText}
        data-alignment={settings.alignment ?? "center"}
      >
        {settings.content}
      </p>
    );
  if (block.type === "divider")
    return <hr className={styles.richDivider} data-style={settings.style} />;
  if (block.type === "image")
    return (
      <div className={styles.richMedia}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.richImage}
          src={settings.imageUrl}
          alt={settings.alt}
        />
      </div>
    );
  if (block.type === "video") {
    const src = youtubeEmbedUrl(settings.url);
    return src ? (
      <div className={styles.richEmbed}>
        <iframe src={src} title={settings.title} allowFullScreen />
      </div>
    ) : null;
  }
  if (block.type === "spotify") {
    const src = spotifyEmbedUrl(settings.url);
    return src ? (
      <div className={`${styles.richEmbed} ${styles.richSpotify}`}>
        <iframe src={src} title={settings.title} />
      </div>
    ) : null;
  }
  if (block.type === "qr")
    return (
      <PreviewQr
        destinationUrl={settings.destinationUrl}
        title={settings.title}
      />
    );
  const href = richBlockHref(block.type, settings);
  if (!href) return null;
  const label =
    block.type === "file" ||
    block.type === "event" ||
    block.type === "appointment"
      ? settings.title
      : settings.label;
  return (
    <span className={styles.richAction} data-href={href}>
      <span>{label}</span>
      {block.type === "event" && settings.date && (
        <small>{settings.date}</small>
      )}
    </span>
  );
}

export function SmartPagePreview({ page }: { page: SmartPagePreviewData }) {
  const visible = page.blocks.filter(
    (block) =>
      block.visible &&
      (!block.link ||
        (block.link.isActive &&
          (!block.link.expiresAt ||
            new Date(block.link.expiresAt) > new Date()))),
  );

  return (
    <div className="smart-page-preview" aria-label="Prévia da Smart Page">
      <PageDesign
        title={page.title}
        description={page.description}
        avatarUrl={page.avatarUrl}
        theme={page.theme}
        preview
        socials={
          page.socialLinks.length ? (
            <PageSocialLinks links={page.socialLinks} theme={page.theme} />
          ) : undefined
        }
      >
        {visible.map((block) =>
          block.type === "product" ? (
            <span key={block.id}>
              {block.product?.name ?? "Produto indisponível"}
            </span>
          ) : block.type === "link" ? (
            <span key={block.id}>{block.settings.title}</span>
          ) : block.type === "form" && block.form ? (
            <SmartPageForm
              key={block.id}
              slug="preview"
              blockId={block.id}
              form={block.form}
              preview
            />
          ) : (
            <PreviewRichBlock key={block.id} block={block} />
          ),
        )}
        {!visible.length && <p>Adicione seu primeiro conteúdo.</p>}
      </PageDesign>
    </div>
  );
}
