import { PageDesign } from "@/components/smart-pages/page-design";
import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await findSmartPage(slug);
  if (!page) return {};
  const url = new URL(`/page/${encodeURIComponent(page.slug)}`, appUrl()).href;
  return {
    title: { absolute: page.title },
    description: page.description || undefined,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: page.title,
      description: page.description || undefined,
      siteName: "Arrume Meu Link",
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
          href: `/page/${encodeURIComponent(page.slug)}/produto/${encodeURIComponent(block.product.id)}`,
        },
      ];
    }
    return [];
  });

  return (
    <section className="smart-page-public">
      <PageDesign
        title={page.title}
        description={page.description}
        avatarUrl={page.avatarUrl}
        theme={theme}
        socials={
          socialLinks.length ? (
            <nav aria-label={`Redes de ${page.title}`}>
              {socialLinks.map((social) => (
                <a
                  key={social.network}
                  href={social.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {social.network}
                </a>
              ))}
            </nav>
          ) : undefined
        }
      >
        {blocks.map((block) =>
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
          ) : (
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
          ),
        )}
        {!blocks.length && <p>Nenhum link disponível.</p>}
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
