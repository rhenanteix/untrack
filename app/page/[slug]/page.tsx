import { PageDesign } from "@/components/smart-pages/page-design";
import {
  isRichBlockType,
  parseRichBlockSettings,
  richBlockHref,
  spotifyEmbedUrl,
  type RichBlockSettings,
  type RichBlockType,
  youtubeEmbedUrl,
} from "@/components/smart-pages/rich-block";
import { PageSocialLinks } from "@/components/smart-pages/social-links";
import styles from "@/components/smart-pages/themes.module.css";
import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import {
  SmartPageLink,
  SmartPageTracker,
} from "@/components/smart-page-tracker";
import { appUrl } from "@/lib/app-url";
import { isProductPublic } from "@/modules/products/availability";
import { productBlockSettingsSchema } from "@/modules/products/schemas";
import { publicSmartPage } from "@/modules/smart-pages/service";
import {
  linkBlockSettingsSchema,
  smartPageThemeSchema,
  socialLinksSchema,
} from "@/modules/smart-pages/schemas";

export const dynamic = "force-dynamic";

const findSmartPage = cache(publicSmartPage);

type PublicBlock =
  | {
      type: "link";
      id: string;
      analyticsEnabled: boolean;
      title: string;
      href: string;
      openInNewTab: boolean;
    }
  | {
      type: "product";
      id: string;
      analyticsEnabled: boolean;
      name: string;
      buttonLabel: string;
      href: string;
    }
  | {
      type: RichBlockType;
      id: string;
      analyticsEnabled: boolean;
      settings: RichBlockSettings;
    };

function publicHref(
  link: { slug: string; domainKey: string } | null,
  destinationUrl: string | undefined,
) {
  if (!link) return destinationUrl ?? null;
  if (link.domainKey === "platform")
    return `/s/${encodeURIComponent(link.slug)}`;
  return `https://${link.domainKey}/s/${encodeURIComponent(link.slug)}`;
}

function RichAction({
  block,
  slug,
  href,
  children,
  openInNewTab = false,
  media = false,
}: {
  block: Extract<PublicBlock, { settings: RichBlockSettings }>;
  slug: string;
  href: string;
  children: React.ReactNode;
  openInNewTab?: boolean;
  media?: boolean;
}) {
  return (
    <SmartPageLink
      slug={slug}
      blockId={block.id}
      href={href}
      openInNewTab={openInNewTab}
      className={
        media
          ? `${styles.richAction} ${styles.richMediaAction}`
          : styles.richAction
      }
    >
      {children}
    </SmartPageLink>
  );
}

async function renderRichBlock(
  block: Extract<PublicBlock, { settings: RichBlockSettings }>,
  slug: string,
) {
  const { settings } = block;
  if (block.type === "title") {
    const Tag = settings.level === "h3" ? "h3" : "h2";
    return (
      <Tag
        key={block.id}
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
        key={block.id}
        className={styles.richText}
        data-alignment={settings.alignment ?? "center"}
      >
        {settings.content}
      </p>
    );
  if (block.type === "divider")
    return (
      <hr
        key={block.id}
        className={styles.richDivider}
        data-style={settings.style}
      />
    );
  if (block.type === "image") {
    const image = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={styles.richImage}
        src={settings.imageUrl}
        alt={settings.alt}
      />
    );
    const href = richBlockHref(block.type, settings);
    return href ? (
      <RichAction
        key={block.id}
        block={block}
        slug={slug}
        href={href}
        openInNewTab
        media
      >
        {image}
      </RichAction>
    ) : (
      <div key={block.id} className={styles.richMedia}>
        {image}
      </div>
    );
  }
  if (block.type === "video") {
    const src = youtubeEmbedUrl(settings.url);
    return src ? (
      <div key={block.id} className={styles.richEmbed}>
        <iframe
          src={src}
          title={settings.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    ) : null;
  }
  if (block.type === "spotify") {
    const src = spotifyEmbedUrl(settings.url);
    return src ? (
      <div
        key={block.id}
        className={`${styles.richEmbed} ${styles.richSpotify}`}
      >
        <iframe
          src={src}
          title={settings.title}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        />
      </div>
    ) : null;
  }
  if (block.type === "qr") {
    const dataUrl = await QRCode.toDataURL(settings.destinationUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 300,
    });
    return (
      <div key={block.id} className={styles.richQr}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt={`QR Code: ${settings.title}`} />
        <span>{settings.title}</span>
      </div>
    );
  }
  const href = richBlockHref(block.type, settings);
  if (!href) return null;
  const label =
    block.type === "file" ||
    block.type === "event" ||
    block.type === "appointment"
      ? settings.title
      : settings.label;
  return (
    <RichAction
      key={block.id}
      block={block}
      slug={slug}
      href={href}
      openInNewTab={["file", "event", "appointment"].includes(block.type)}
    >
      <span>{label}</span>
      {block.type === "event" && settings.date && (
        <small>{settings.date}</small>
      )}
    </RichAction>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await findSmartPage(slug);
  if (!page) return {};
  const url = new URL(`/${encodeURIComponent(page.slug)}`, appUrl()).href;
  return {
    title: { absolute: page.title },
    description: page.description || undefined,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: page.title,
      description: page.description || undefined,
      siteName: "LinkOr",
      images: page.avatarUrl ? [{ url: page.avatarUrl }] : undefined,
    },
    twitter: {
      card: page.avatarUrl ? "summary_large_image" : "summary",
      title: page.title,
      description: page.description || undefined,
      images: page.avatarUrl ? [page.avatarUrl] : undefined,
    },
  };
}

export default async function PublicSmartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await findSmartPage(slug);
  if (!page) notFound();
  const theme = smartPageThemeSchema.safeParse(page.theme).data ?? {
    preset: "minimal",
  };
  const socialLinks = socialLinksSchema.safeParse(page.socialLinks).data ?? [];

  const now = new Date();
  const blocks: PublicBlock[] = page.blocks.flatMap<PublicBlock>((block) => {
    if (block.type === "link") {
      const settings = linkBlockSettingsSchema.safeParse(block.settings);
      if (!settings.success) return [];
      if (
        block.link &&
        (!block.link.isActive ||
          (block.link.expiresAt !== null && block.link.expiresAt <= now))
      ) {
        return [];
      }
      const href = publicHref(block.link, settings.data.destinationUrl);
      return href
        ? [
            {
              type: "link",
              id: block.id,
              analyticsEnabled: block.analyticsEnabled,
              title: settings.data.title,
              href,
              openInNewTab: settings.data.openInNewTab,
            },
          ]
        : [];
    }
    if (block.type === "product") {
      const settings = productBlockSettingsSchema.safeParse(block.settings);
      if (
        !settings.success ||
        !block.product ||
        !isProductPublic(block.product, now)
      )
        return [];
      return [
        {
          type: "product",
          id: block.id,
          analyticsEnabled: block.analyticsEnabled,
          name: block.product.name,
          buttonLabel: settings.data.buttonLabel,
          href: `/${encodeURIComponent(page.slug)}/produto/${encodeURIComponent(block.product.id)}`,
        },
      ];
    }
    if (isRichBlockType(block.type)) {
      const settings = parseRichBlockSettings(block.type, block.settings);
      return settings
        ? [
            {
              type: block.type,
              id: block.id,
              analyticsEnabled: block.analyticsEnabled,
              settings,
            },
          ]
        : [];
    }
    return [];
  });
  const renderedBlocks = await Promise.all(
    blocks.map((block) =>
      block.type === "link" ? (
        <SmartPageLink
          key={block.id}
          slug={page.slug}
          blockId={block.id}
          href={block.href}
          openInNewTab={block.openInNewTab}
        >
          {block.title}
        </SmartPageLink>
      ) : block.type === "product" ? (
        <SmartPageLink
          key={block.id}
          slug={page.slug}
          blockId={block.id}
          href={block.href}
          openInNewTab={false}
          event="link_in_bio_product_click"
        >
          {block.name} - {block.buttonLabel}
        </SmartPageLink>
      ) : (
        renderRichBlock(block, page.slug)
      ),
    ),
  );

  return (
    <section className="smart-page-public">
      <PageDesign
        title={page.title}
        description={page.description}
        avatarUrl={page.avatarUrl}
        theme={theme}
        socials={
          socialLinks.length ? (
            <PageSocialLinks
              links={socialLinks}
              theme={theme}
              label={`Redes de ${page.title}`}
            />
          ) : undefined
        }
      >
        {renderedBlocks}
        {!renderedBlocks.filter(Boolean).length && (
          <p>Nenhum conteúdo disponível.</p>
        )}
      </PageDesign>
      <SmartPageTracker
        slug={page.slug}
        blocks={blocks
          .filter((block) => block.analyticsEnabled)
          .map((block) => ({ id: block.id, type: block.type }))}
      />
    </section>
  );
}
