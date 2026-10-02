import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { PublicSmartCard } from "@/components/smart-cards/public-smart-card";
import { appUrl } from "@/lib/app-url";
import { publicSmartCard } from "@/modules/smart-cards/service";
import {
  defaultSmartCardContactForm,
  defaultSmartCardTheme,
  smartCardContactFormSchema,
  smartCardThemeSchema,
} from "@/modules/smart-cards/schemas";

export const dynamic = "force-dynamic";

const findCard = cache(publicSmartCard);

type Context = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: Pick<Context, "params">): Promise<Metadata> {
  const { slug } = await params;
  const card = await findCard(slug);
  if (!card) return {};
  const title = `${card.firstName} ${card.lastName}`.trim();
  const description = [card.headline, card.company, card.bio]
    .filter(Boolean)
    .join(" · ");
  return {
    title: { absolute: title },
    description: description || undefined,
    alternates: { canonical: new URL(`/c/${card.slug}`, appUrl()).href },
    openGraph: {
      type: "profile",
      title,
      description: description || undefined,
      images: card.avatarUrl ? [{ url: card.avatarUrl }] : undefined,
    },
  };
}

export default async function SmartCardPublicPage({
  params,
  searchParams,
}: Context) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const card = await findCard(slug);
  if (!card) notFound();
  const source =
    typeof query.source === "string" ? query.source.slice(0, 80) : "direct";
  const theme =
    smartCardThemeSchema.safeParse(card.theme).data ?? defaultSmartCardTheme;
  const contactForm =
    smartCardContactFormSchema.safeParse(card.contactForm).data ??
    defaultSmartCardContactForm;
  return (
    <PublicSmartCard
      card={card}
      contactForm={contactForm}
      theme={theme}
      source={source}
    />
  );
}
