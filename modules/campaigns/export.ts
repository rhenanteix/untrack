import { getPrisma } from "@/lib/prisma";
import { Actor } from "@/modules/workspaces/context";
import { ApiError } from "@/lib/api-response";
import { PDFDocument, rgb } from "pdf-lib";

export async function exportCampaignCsv(actor: Actor, campaignId: string) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: actor.workspaceId },
    include: {
      client: { select: { name: true } },
      responsible: { select: { name: true } },
      channels: true,
      checklistItems: true,
      approvals: { include: { approver: { select: { name: true } } } },
    },
  });
  if (!campaign) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");

  const headers = ["Campanha", "Nome", "Descrição", "Cliente", "Responsável", "Objetivo", "Status", "Canal", "Tipo", "Destino", "UTM Source", "UTM Medium", "UTM Campaign", "Monitoramento", "Checklist Item", "Checklist Status", "Aprovado por", "Data Aprovação"];
  const rows = [headers.join(",")];

  const clientName = campaign?.client?.name ?? "";
  const responsibleName = campaign?.responsible?.name ?? "";
  const approver = campaign?.approvals[0]?.approver?.name ?? "";
  const approvedAt = campaign?.approvals[0]?.createdAt ? new Date(campaign.approvals[0].createdAt).toISOString() : "";

  if (campaign.channels.length === 0) {
    rows.push([
      campaign.name,
      campaign.name,
      `"${(campaign.description ?? "").replace(/"/g, '""')}"`,
       clientName,
       responsibleName,
       `"${(campaign.objective ?? "").replace(/"/g, '""')}"`,
      campaign.status,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      approver,
      approvedAt,
    ].join(","));
  } else {
    for (const ch of campaign.channels) {
      const checklist = campaign.checklistItems.filter((c) => c.channelId === ch.id || !c.channelId);
      const checklistLabels = checklist.map((c) => c.label).join("; ");
      const checklistStatuses = checklist.map((c) => c.status).join("; ");
      rows.push([
        campaign.name,
        campaign.name,
      `"${(campaign.description ?? "").replace(/"/g, '""')}"`,
         clientName,
         responsibleName,
         `"${(campaign.objective ?? "").replace(/"/g, '""')}"`,
        campaign.status,
        ch.name,
        ch.type,
        ch.destinationUrl,
        ch.utmSource ?? "",
        ch.utmMedium ?? "",
        ch.utmCampaign ?? "",
        ch.monitorEnabled ? `A cada ${ch.monitorFrequencyMinutes} min` : "Desativado",
        `"${checklistLabels.replace(/"/g, '""')}"`,
        checklistStatuses,
        approver,
        approvedAt,
      ].join(","));
    }
  }

  return rows.join("\n");
}

export async function exportCampaignPdf(actor: Actor, campaignId: string) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: actor.workspaceId },
    include: { client: { select: { name: true } }, responsible: { select: { name: true } }, channels: true, checklistItems: true, approvals: { include: { approver: { select: { name: true } } } } },
  });
  if (!campaign) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const { height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const drawText = (text: string, size = 12) => {
    page.drawText(text, { x: margin, y, size, color: rgb(0, 0, 0) });
    y -= size + 6;
  };

   drawText(`Relatório: ${campaign.name}`, 18);
   y -= 6;
   drawText(`Descrição: ${campaign.description || "—"}`);
   drawText(`Objetivo: ${campaign.objective || "—"}`);
   drawText(`Status: ${campaign.status}`);
   drawText(`Cliente: ${campaign.client?.name ?? "—"}`);
   drawText(`Responsável: ${campaign.responsible?.name ?? "—"}`);
   drawText(`Período: ${campaign.startDate ? new Date(campaign.startDate).toLocaleDateString("pt-BR") : "—"} a ${campaign.endDate ? new Date(campaign.endDate).toLocaleDateString("pt-BR") : "—"}`);
   y -= 6;

   drawText("Canais", 14);
   for (const ch of campaign.channels) {
     drawText(`• ${ch.name} (${ch.type}): ${ch.destinationUrl}`);
     drawText(`  UTM: source=${ch.utmSource ?? "—"} medium=${ch.utmMedium ?? "—"} campaign=${ch.utmCampaign ?? "—"}`);
     drawText(`  Monitoramento: ${ch.monitorEnabled ? `A cada ${ch.monitorFrequencyMinutes} min` : "Desativado"}`);
   }
   y -= 6;

   drawText("Checklist", 14);
   for (const item of campaign.checklistItems) {
     drawText(`• [${item.status.toUpperCase()}] ${item.label} (${item.severity})`);
   }
   y -= 6;

   drawText("Aprovação", 14);
  for (const approval of campaign.approvals) {
    drawText(`• ${approval.action.toUpperCase()} por ${approval.approver.name} em ${new Date(approval.createdAt).toLocaleString("pt-BR")}`);
    drawText(`  Notas: ${approval.notes || "—"}`);
  }

  const pdfBytes = await pdf.save();
  return Buffer.from(pdfBytes);
}
