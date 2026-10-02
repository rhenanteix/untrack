import { PageDesign } from "@/components/smart-pages/page-design";
import type { SmartPageTheme } from "@/modules/smart-pages/themes";
import type { SmartPageContentBlock } from "./content-block";

export interface SmartPagePreviewData {
  title: string;
  description: string;
  avatarUrl: string | null;
  theme: SmartPageTheme;
  socialLinks: { network: string; url: string }[];
  blocks: SmartPageContentBlock[];
}

export function SmartPagePreview({ page }: { page: SmartPagePreviewData }) {
  const visible = page.blocks.filter(
    (block) =>
      block.visible &&
      (!block.link ||
        (block.link.isActive &&
          (!block.link.expiresAt || new Date(block.link.expiresAt) > new Date()))),
  );

  return (
    <div className="smart-page-preview" aria-label="Prévia da Smart Page">
      <PageDesign
        title={page.title}
        description={page.description}
        avatarUrl={page.avatarUrl}
        theme={page.theme}
        preview
        socials={page.socialLinks.map((social) => (
          <span key={social.network}>{social.network}</span>
        ))}
      >
        {visible.map((block) => (
          <span key={block.id}>
            {block.type === "product"
              ? (block.product?.name ?? "Produto indisponível")
              : block.settings.title}
          </span>
        ))}
        {!visible.length && <p>Adicione seu primeiro conteúdo.</p>}
      </PageDesign>
    </div>
  );
}