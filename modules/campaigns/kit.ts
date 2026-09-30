import { getPrisma } from "@/lib/prisma";
import { Actor } from "@/modules/workspaces/context";
import { ApiError } from "@/lib/api-response";
import { audit } from "@/modules/workspaces/context";
import { generateUtmUrl } from "@/modules/utm/utm.service";
import { campaignKitInputSchema, campaignKitProposalSchema, type CampaignKitInput, type CampaignKitProposal } from "./schemas";

function buildSlug(name: string, pattern: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  if (!pattern) return `${base}-${date}`;
  return pattern
    .replace("{name}", base)
    .replace("{date}", date)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || `${base}-${date}`;
}

export async function proposeKit(actor: Actor, input: CampaignKitInput): Promise<CampaignKitProposal> {
  const parsed = campaignKitInputSchema.parse(input);
  const { destination, channels, namingPattern, campaignName, utmSource, utmCampaign } = parsed;
  const proposals = channels.map((ch) => {
    const source = utmSource ?? ch.name;
    const medium = ch.type;
    const campaign = utmCampaign ?? campaignName ?? ch.name;
    const term = "";
    const content = ch.name;
    const url = generateUtmUrl({ url: destination, source, medium, campaign, term, content });
    const slug = buildSlug(ch.name, namingPattern);
    const qrToken = `qr-${slug}`;
    return {
      name: ch.name,
      type: ch.type,
      destinationUrl: url,
      utmSource: source,
      utmMedium: medium,
      utmCampaign: campaign,
      utmTerm: term || null,
      utmContent: content || null,
      shortLinkSlug: slug,
      qrToken,
    };
  });
  return campaignKitProposalSchema.parse({ channels: proposals });
}

export async function saveKit(actor: Actor, campaignId: string, proposal: CampaignKitProposal) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: actor.workspaceId },
  });
  if (!campaign) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  const parsed = campaignKitProposalSchema.parse(proposal);
  const created: typeof parsed.channels = [];
  for (const ch of parsed.channels) {
    const channel = await prisma.campaignChannel.create({
      data: {
        workspaceId: actor.workspaceId,
        campaignId,
        name: ch.name,
        type: ch.type,
        destinationUrl: ch.destinationUrl,
        utmSource: ch.utmSource,
        utmMedium: ch.utmMedium,
        utmCampaign: ch.utmCampaign,
        utmTerm: ch.utmTerm,
        utmContent: ch.utmContent,
      },
    });
    created.push(channel as typeof ch);
  }
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "draft" } });
  await prisma.$transaction(async (tx) => {
    await audit(tx, actor, "kit.save", campaignId, { count: created.length });
  });
  return created;
}
