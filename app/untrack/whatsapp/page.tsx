import { notFound } from "next/navigation";
import { WhatsAppIntelligence } from "@/components/untrack/whatsapp-intelligence";
import { isWhatsAppIntelligenceEnabled } from "@/modules/whatsapp/feature";

export const metadata = { title: "WhatsApp Intelligence" };
export const dynamic = "force-dynamic";

export default function WhatsAppPage() {
  if (!isWhatsAppIntelligenceEnabled()) notFound();
  return <WhatsAppIntelligence />;
}