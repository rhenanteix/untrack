import { getPrisma } from "@/lib/prisma";

export type ActivationState = {
  hasCreatedAsset: boolean;
  hasPublishedOrSharedAsset: boolean;
  hasInteraction: boolean;
  activated: boolean;
};

export async function getActivationState(
  workspaceId: string,
): Promise<ActivationState> {
  const db = getPrisma();
  const [links, pages, cards, publishedPages, publishedCards, interactions] =
    await Promise.all([
      db.shortLink.count({ where: { workspaceId } }),
      db.smartPage.count({ where: { workspaceId } }),
      db.smartCard.count({ where: { workspaceId } }),
      db.smartPage.count({ where: { workspaceId, status: "published" } }),
      db.smartCard.count({ where: { workspaceId, status: "published" } }),
      Promise.all([
        db.linkClick.count({ where: { link: { workspaceId } } }),
        db.analyticsEvent.count({
          where: {
            workspaceId,
            name: { in: ["smart_page_view", "card_view"] },
          },
        }),
      ]),
    ]);
  const hasCreatedAsset = links + pages + cards > 0;
  const hasPublishedOrSharedAsset = links > 0 || publishedPages > 0 || publishedCards > 0;
  const hasInteraction = interactions[0] + interactions[1] > 0;
  return {
    hasCreatedAsset,
    hasPublishedOrSharedAsset,
    hasInteraction,
    activated: hasCreatedAsset && hasPublishedOrSharedAsset && hasInteraction,
  };
}

export async function isActivated(workspaceId: string) {
  return (await getActivationState(workspaceId)).activated;
}