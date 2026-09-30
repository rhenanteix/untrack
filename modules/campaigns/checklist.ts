import { getPrisma } from "@/lib/prisma";
import { Actor } from "@/modules/workspaces/context";
import { ApiError } from "@/lib/api-response";
import { audit } from "@/modules/workspaces/context";
import { checkUrl } from "@/lib/safe-url-check";
import type { ChecklistStatus, ChecklistSeverity } from "./schemas";

export interface ChecklistRunResult {
  items: Array<{
    id: string;
    category: string;
    label: string;
    status: ChecklistStatus;
    severity: ChecklistSeverity;
    details: string;
    checkedAt: Date | null;
  }>;
  summary: Record<string, number>;
  checkedAt: Date;
}

export async function runChecklist(actor: Actor, campaignId: string): Promise<ChecklistRunResult> {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: actor.workspaceId },
    include: { channels: true },
  });
  if (!campaign) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");

  const items: Array<{
    category: string;
    label: string;
    status: ChecklistStatus;
    severity: ChecklistSeverity;
    details: string;
    checkedAt: Date | null;
  }> = [];

  const add = (category: string, label: string, status: ChecklistStatus, severity: ChecklistSeverity, details: string) => {
    items.push({ category, label, status, severity, details, checkedAt: new Date() });
  };

  const hasChannels = campaign.channels.length > 0;
  if (!hasChannels) {
    add("estrutura", "Canais vinculados", "blocked", "blocker", "Nenhum canal configurado.");
  }

  for (const ch of campaign.channels) {
    const url = ch.destinationUrl;
    if (!url) {
      add("url", `URL do canal: ${ch.name}`, "blocked", "blocker", "URL de destino ausente.");
      continue;
    }

    let urlCheck: { status: number; finalUrl: string; redirects: number } | null = null;
    try {
      const result = await checkUrl(url);
      urlCheck = { status: result.status, finalUrl: result.finalUrl, redirects: result.redirects };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao verificar URL.";
      add("url", `Validade da URL: ${ch.name}`, "blocked", "blocker", message);
    }

    if (urlCheck) {
      if (urlCheck.status >= 400 && urlCheck.status !== 403 && urlCheck.status !== 429) {
        add("url", `Validade da URL: ${ch.name}`, "blocked", "blocker", `HTTP ${urlCheck.status}.`);
      } else if (urlCheck.status === 403 || urlCheck.status === 429) {
        add("url", `Validade da URL: ${ch.name}`, "warning", "warning", `HTTP ${urlCheck.status}: possível limitação do destino ou monitor.`);
      } else {
        add("url", `Validade da URL: ${ch.name}`, "approved", "info", `HTTP ${urlCheck.status}.`);
      }

      if (urlCheck.redirects > 0) {
        add("redirects", `Cadeia de redirect: ${ch.name}`, "approved", "info", `${urlCheck.redirects} redirect(s).`);
      }
    }

    if (!ch.utmSource || !ch.utmMedium || !ch.utmCampaign) {
      add("utm", `Regras UTM: ${ch.name}`, "blocked", "blocker", "UTM incompleto.");
    } else {
      add("utm", `Regras UTM: ${ch.name}`, "approved", "info", "UTM completo.");
    }

    if (ch.monitorEnabled && ch.monitorPaused) {
      add("monitor", `Monitoramento: ${ch.name}`, "warning", "warning", "Monitoramento pausado.");
    } else if (ch.monitorEnabled) {
      add("monitor", `Monitoramento: ${ch.name}`, "approved", "info", `Verificação a cada ${ch.monitorFrequencyMinutes} min.`);
    } else {
      add("monitor", `Monitoramento: ${ch.name}`, "warning", "warning", "Monitoramento desativado.");
    }
  }

  const summary = { approved: 0, blocked: 0, warning: 0, pending: 0 } satisfies Record<string, number>;
  for (const it of items) {
    const key = it.status === "approved" ? "approved" : it.status === "blocked" ? "blocked" : it.status === "warning" ? "warning" : "pending";
    summary[key] = (summary[key] || 0) + 1;
  }
  const checkedAt = new Date();

  await prisma.campaignChecklist.deleteMany({ where: { campaignId, workspaceId: actor.workspaceId } });
  await prisma.campaignChecklist.createMany({
    data: items.map((it) => ({
      ...it,
      campaignId,
      workspaceId: actor.workspaceId,
      checkedAt: checkedAt,
    })),
  });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { updatedAt: checkedAt },
  });

  const created = await prisma.campaignChecklist.findMany({
    where: { campaignId, workspaceId: actor.workspaceId },
    orderBy: { createdAt: "asc" },
  });

  await prisma.$transaction(async (tx) => {
    await audit(tx, actor, "checklist.run", campaignId, { summary });
  });

  return {
    items: created.map((item) => ({
      id: item.id,
      category: item.category,
      label: item.label,
      status: item.status as ChecklistStatus,
      severity: item.severity as ChecklistSeverity,
      details: item.details,
      checkedAt: item.checkedAt,
    })),
    summary,
    checkedAt,
  };
}
