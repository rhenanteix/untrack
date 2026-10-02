"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { HiOutlineXMark } from "react-icons/hi2";
import { BlockDestinationFields } from "@/components/smart-pages/block-destination-fields";
import { SmartField, SmartForm } from "@/components/smart-pages/smart-form";
import { ContentBlock, type SmartPageContentBlock } from "./content-block";

export function ContentList({
  blocks,
  drafts,
  managedLinks,
  busy,
  failure,
  canEdit,
  onDraftChange,
  onSaveProduct,
  onToggle,
  onDelete,
  onReorder,
}: {
  blocks: SmartPageContentBlock[];
  drafts: Record<string, SmartPageContentBlock>;
  managedLinks: {
    id: string;
    title: string;
    slug: string;
    domainKey: string;
    isActive: boolean;
    expiresAt: string | null;
  }[];
  busy: boolean;
  failure: Error | null;
  canEdit: boolean;
  onDraftChange: (block: SmartPageContentBlock) => void;
  onSaveProduct: (
    event: FormEvent<HTMLFormElement>,
    block: SmartPageContentBlock,
  ) => void;
  onToggle: (block: SmartPageContentBlock) => void;
  onDelete: (block: SmartPageContentBlock) => void;
  onReorder: (blockIds: string[]) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  function reorder(draggedBlockId: string, targetBlockId: string) {
    if (draggedBlockId === targetBlockId) return;
    const next = [...blocks];
    const draggedIndex = next.findIndex((block) => block.id === draggedBlockId);
    const targetIndex = next.findIndex((block) => block.id === targetBlockId);
    if (draggedIndex < 0 || targetIndex < 0) return;
    const [dragged] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, dragged);
    onReorder(next.map((block) => block.id));
  }

  function move(block: SmartPageContentBlock, direction: -1 | 1) {
    const currentIndex = blocks.findIndex((item) => item.id === block.id);
    const target = blocks[currentIndex + direction];
    if (target) reorder(block.id, target.id);
  }

  function handleDraftChange(
    event: FormEvent<HTMLFormElement>,
    block: SmartPageContentBlock,
  ) {
    const data = new FormData(event.currentTarget);
    onDraftChange({
      ...block,
      linkId: String(data.get("linkId") || "") || null,
      link:
        managedLinks.find((link) => link.id === data.get("linkId")) ?? null,
      visible: data.get("visible") === "on",
      settings: {
        ...block.settings,
        title: String(data.get("title") ?? ""),
        destinationUrl: String(data.get("destinationUrl") ?? ""),
        openInNewTab: data.get("openInNewTab") === "on",
      },
    });
  }

  if (!blocks.length) {
    return (
      <div className="sp-content-empty">
        <h3>Sua página ainda está vazia.</h3>
        <p>Adicione seu primeiro conteúdo para começar a montar a página.</p>
      </div>
    );
  }

  return (
    <ol className="sp-content-block-list">
      {blocks.map((block, index) => {
        const draft = drafts[block.id] ?? block;
        const expanded = expandedId === block.id;
        return (
          <li key={block.id}>
            <ContentBlock
              block={draft}
              index={index}
              disabled={!canEdit || busy}
              onEdit={(item) => setExpandedId((current) => current === item.id ? null : item.id)}
              onToggle={onToggle}
              onDelete={onDelete}
              onMove={move}
              onDragStart={(event: DragEvent<HTMLElement>, blockId) => {
                setDraggedId(blockId);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", blockId);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event, targetBlockId) => {
                event.preventDefault();
                reorder(
                  draggedId ?? event.dataTransfer.getData("text/plain"),
                  targetBlockId,
                );
                setDraggedId(null);
              }}
            />
            {expanded && (
              <div className="sp-content-block-editor" role="region" aria-label={`Editar ${draft.settings.title ?? draft.product?.name ?? "conteúdo"}`}>
                <div className="sp-content-block-editor-heading">
                  <strong>Editar conteúdo</strong>
                  <button
                    type="button"
                    aria-label="Fechar edição"
                    onClick={() => setExpandedId(null)}
                  >
                    <HiOutlineXMark aria-hidden="true" />
                  </button>
                </div>
                {block.type === "product" ? (
                  <SmartForm
                    failure={failure}
                    onSubmit={(event) => onSaveProduct(event, block)}
                  >
                    <input type="hidden" name="visible" value={block.visible ? "on" : "off"} />
                    <SmartField>
                      Texto do botão
                      <input
                        required
                        name="buttonLabel"
                        maxLength={40}
                        defaultValue={block.settings.buttonLabel ?? "Ver produto"}
                      />
                    </SmartField>
                    <details className="sp-block-advanced">
                      <summary>Opções avançadas</summary>
                      <SmartField className="smart-page-check">
                        <input
                          type="checkbox"
                          name="analyticsEnabled"
                          defaultChecked={block.analyticsEnabled}
                        />{" "}
                        Medir cliques
                      </SmartField>
                    </details>
                    <button className="button button-secondary" disabled={busy || !canEdit}>
                      Salvar
                    </button>
                  </SmartForm>
                ) : (
                  <SmartForm
                    failure={failure}
                    onChange={(event) => handleDraftChange(event, block)}
                    onSubmit={(event) => event.preventDefault()}
                  >
                    <input type="hidden" name="visible" value={draft.visible ? "on" : "off"} />
                    <SmartField>
                      Título
                      <input
                        required
                        name="title"
                        maxLength={120}
                        defaultValue={block.settings.title}
                      />
                    </SmartField>
                    <BlockDestinationFields
                      links={managedLinks}
                      initialUrl={block.settings.destinationUrl}
                      initialLinkId={block.linkId}
                    />
                    <details className="sp-block-advanced">
                      <summary>Opções avançadas</summary>
                      <SmartField className="smart-page-check">
                        <input
                          type="checkbox"
                          name="openInNewTab"
                          defaultChecked={block.settings.openInNewTab}
                        />{" "}
                        Abrir em nova aba
                      </SmartField>
                      <SmartField className="smart-page-check">
                        <input
                          type="checkbox"
                          name="analyticsEnabled"
                          defaultChecked={block.analyticsEnabled}
                        />{" "}
                        Medir cliques
                      </SmartField>
                    </details>
                  </SmartForm>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}