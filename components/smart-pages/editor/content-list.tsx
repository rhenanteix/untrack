"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { HiOutlineXMark } from "react-icons/hi2";
import { BlockDestinationFields } from "@/components/smart-pages/block-destination-fields";
import {
  SmartField,
  SmartForm,
  SmartSelect,
} from "@/components/smart-pages/smart-form";
import { ContentBlock, type SmartPageContentBlock } from "./content-block";
import { FormBuilder, type SmartPageFormSettings } from "./form-builder";

export function ContentList({
  blocks,
  drafts,
  managedLinks,
  busy,
  failure,
  canEdit,
  onDraftChange,
  onSaveProduct,
  onSaveBlock,
  onSaveForm,
  initialExpandedBlockId,
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
  onSaveBlock: (
    event: FormEvent<HTMLFormElement>,
    block: SmartPageContentBlock,
    settings: SmartPageContentBlock["settings"],
  ) => void;
  onSaveForm: (
    block: SmartPageContentBlock,
    settings: SmartPageFormSettings,
  ) => void;
  initialExpandedBlockId?: string | null;
  onToggle: (block: SmartPageContentBlock) => void;
  onDelete: (block: SmartPageContentBlock) => void;
  onReorder: (blockIds: string[]) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(
    initialExpandedBlockId ?? null,
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

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
      link: managedLinks.find((link) => link.id === data.get("linkId")) ?? null,
      visible: data.get("visible") === "on",
      settings: {
        ...block.settings,
        title: String(data.get("title") ?? ""),
        destinationUrl: String(data.get("destinationUrl") ?? ""),
        openInNewTab: data.get("openInNewTab") === "on",
      },
    });
  }

  function settingsFromForm(
    type: SmartPageContentBlock["type"],
    data: FormData,
  ): SmartPageContentBlock["settings"] {
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const alignment = value("alignment");
    if (type === "title")
      return {
        text: value("text"),
        level: value("level") as "h2" | "h3",
        ...(alignment
          ? { alignment: alignment as "left" | "center" | "right" }
          : {}),
      };
    if (type === "text")
      return {
        content: value("content"),
        ...(alignment
          ? { alignment: alignment as "left" | "center" | "right" }
          : {}),
      };
    if (type === "divider")
      return { style: value("style") as "solid" | "dashed" | "dotted" };
    if (type === "image")
      return {
        imageUrl: value("imageUrl"),
        alt: value("alt"),
        destinationUrl: value("destinationUrl") || undefined,
      };
    if (type === "video" || type === "spotify")
      return { url: value("url"), title: value("title") };
    if (type === "file") return { url: value("url"), title: value("title") };
    if (type === "qr")
      return { destinationUrl: value("destinationUrl"), title: value("title") };
    if (type === "whatsapp")
      return {
        number: value("number"),
        message: value("message"),
        label: value("label"),
      };
    if (type === "email")
      return {
        address: value("address"),
        subject: value("subject"),
        label: value("label"),
      };
    if (type === "phone")
      return { number: value("number"), label: value("label") };
    if (type === "event")
      return {
        title: value("title"),
        date: value("date"),
        destinationUrl: value("destinationUrl"),
      };
    if (type === "appointment")
      return { title: value("title"), destinationUrl: value("destinationUrl") };
    return {};
  }

  function renderSettingsFields(block: SmartPageContentBlock) {
    const settings = block.settings;
    if (block.type === "title")
      return (
        <>
          <SmartField>
            Título
            <input
              required
              name="text"
              maxLength={120}
              defaultValue={settings.text}
            />
          </SmartField>
          <SmartField>
            Tamanho
            <SmartSelect
              name="level"
              defaultValue={settings.level ?? "h2"}
              options={[
                { value: "h2", label: "Destaque" },
                { value: "h3", label: "Subtítulo" },
              ]}
            />
          </SmartField>
          <SmartField>
            Alinhamento
            <SmartSelect
              name="alignment"
              defaultValue={settings.alignment ?? "center"}
              options={[
                { value: "left", label: "À esquerda" },
                { value: "center", label: "Centralizado" },
                { value: "right", label: "À direita" },
              ]}
            />
          </SmartField>
        </>
      );
    if (block.type === "text")
      return (
        <>
          <SmartField>
            Texto
            <textarea
              required
              name="content"
              maxLength={1000}
              rows={4}
              defaultValue={settings.content}
            />
          </SmartField>
          <SmartField>
            Alinhamento
            <SmartSelect
              name="alignment"
              defaultValue={settings.alignment ?? "center"}
              options={[
                { value: "left", label: "À esquerda" },
                { value: "center", label: "Centralizado" },
                { value: "right", label: "À direita" },
              ]}
            />
          </SmartField>
        </>
      );
    if (block.type === "divider")
      return (
        <SmartField>
          Estilo
          <SmartSelect
            name="style"
            defaultValue={settings.style ?? "solid"}
            options={[
              { value: "solid", label: "Linha contínua" },
              { value: "dashed", label: "Tracejada" },
              { value: "dotted", label: "Pontilhada" },
            ]}
          />
        </SmartField>
      );
    if (block.type === "image")
      return (
        <>
          <SmartField>
            Imagem (URL)
            <input
              required
              type="url"
              name="imageUrl"
              defaultValue={settings.imageUrl}
            />
          </SmartField>
          <SmartField hint="Ajuda leitores de tela a entender a imagem.">
            Descrição da imagem
            <input name="alt" maxLength={160} defaultValue={settings.alt} />
          </SmartField>
          <SmartField hint="Opcional: abre quando alguém seleciona a imagem.">
            Destino da imagem
            <input
              type="url"
              name="destinationUrl"
              defaultValue={settings.destinationUrl}
            />
          </SmartField>
        </>
      );
    if (block.type === "video")
      return (
        <>
          <SmartField hint="Use um endereço do YouTube.">
            Vídeo
            <input required type="url" name="url" defaultValue={settings.url} />
          </SmartField>
          <SmartField>
            Título
            <input name="title" maxLength={120} defaultValue={settings.title} />
          </SmartField>
        </>
      );
    if (block.type === "spotify")
      return (
        <>
          <SmartField hint="Use um link de faixa, álbum ou playlist do Spotify.">
            Spotify
            <input required type="url" name="url" defaultValue={settings.url} />
          </SmartField>
          <SmartField>
            Título
            <input name="title" maxLength={120} defaultValue={settings.title} />
          </SmartField>
        </>
      );
    if (block.type === "file")
      return (
        <>
          <SmartField>
            Nome do arquivo
            <input
              required
              name="title"
              maxLength={120}
              defaultValue={settings.title}
            />
          </SmartField>
          <SmartField>
            Arquivo (URL)
            <input required type="url" name="url" defaultValue={settings.url} />
          </SmartField>
        </>
      );
    if (block.type === "qr")
      return (
        <>
          <SmartField>
            Título
            <input name="title" maxLength={120} defaultValue={settings.title} />
          </SmartField>
          <SmartField>
            Destino do QR Code
            <input
              required
              type="url"
              name="destinationUrl"
              defaultValue={settings.destinationUrl}
            />
          </SmartField>
        </>
      );
    if (block.type === "whatsapp" || block.type === "phone")
      return (
        <>
          <SmartField>
            {block.type === "whatsapp" ? "Número do WhatsApp" : "Telefone"}
            <input
              required
              name="number"
              inputMode="tel"
              defaultValue={settings.number}
            />
          </SmartField>
          <SmartField>
            Texto do botão
            <input
              required
              name="label"
              maxLength={80}
              defaultValue={settings.label}
            />
          </SmartField>
          {block.type === "whatsapp" && (
            <SmartField hint="Opcional: preenche a primeira mensagem da conversa.">
              Mensagem inicial
              <textarea
                name="message"
                maxLength={500}
                rows={3}
                defaultValue={settings.message}
              />
            </SmartField>
          )}
        </>
      );
    if (block.type === "email")
      return (
        <>
          <SmartField>
            E-mail
            <input
              required
              type="email"
              name="address"
              defaultValue={settings.address}
            />
          </SmartField>
          <SmartField>
            Assunto inicial
            <input
              name="subject"
              maxLength={160}
              defaultValue={settings.subject}
            />
          </SmartField>
          <SmartField>
            Texto do botão
            <input
              required
              name="label"
              maxLength={80}
              defaultValue={settings.label}
            />
          </SmartField>
        </>
      );
    if (block.type === "event" || block.type === "appointment")
      return (
        <>
          <SmartField>
            {block.type === "event" ? "Nome do evento" : "Texto do botão"}
            <input
              required
              name="title"
              maxLength={120}
              defaultValue={settings.title}
            />
          </SmartField>
          {block.type === "event" && (
            <SmartField hint="Opcional: use data, horário ou período.">
              Quando acontece
              <input name="date" maxLength={80} defaultValue={settings.date} />
            </SmartField>
          )}
          <SmartField>
            Destino
            <input
              required
              type="url"
              name="destinationUrl"
              defaultValue={settings.destinationUrl}
            />
          </SmartField>
        </>
      );
    return null;
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
              isDragging={draggedId === block.id}
              isDropTarget={dropTargetId === block.id && draggedId !== block.id}
              onEdit={(item) =>
                setExpandedId((current) =>
                  current === item.id ? null : item.id,
                )
              }
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
                setDropTargetId(block.id);
              }}
              onDrop={(event, targetBlockId) => {
                event.preventDefault();
                reorder(
                  draggedId ?? event.dataTransfer.getData("text/plain"),
                  targetBlockId,
                );
                setDraggedId(null);
                setDropTargetId(null);
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDropTargetId(null);
              }}
            />
            {expanded && (
              <div
                className="sp-content-block-editor"
                role="region"
                aria-label={`Editar ${draft.settings.title ?? draft.product?.name ?? "conteúdo"}`}
              >
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
                    <input
                      type="hidden"
                      name="visible"
                      value={block.visible ? "on" : "off"}
                    />
                    <SmartField>
                      Texto do botão
                      <input
                        required
                        name="buttonLabel"
                        maxLength={40}
                        defaultValue={
                          block.settings.buttonLabel ?? "Ver produto"
                        }
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
                    <button
                      className="button button-secondary"
                      disabled={busy || !canEdit}
                    >
                      Salvar
                    </button>
                  </SmartForm>
                ) : block.type === "link" ? (
                  <SmartForm
                    failure={failure}
                    onChange={(event) => handleDraftChange(event, block)}
                    onSubmit={(event) => event.preventDefault()}
                  >
                    <input
                      type="hidden"
                      name="visible"
                      value={draft.visible ? "on" : "off"}
                    />
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
                    </details>
                  </SmartForm>
                ) : block.type === "form" && block.form ? (
                  <FormBuilder
                    form={block.form}
                    busy={busy}
                    canEdit={canEdit}
                    onSave={(settings) => onSaveForm(block, settings)}
                  />
                ) : (
                  <SmartForm
                    failure={failure}
                    onSubmit={(event) =>
                      onSaveBlock(
                        event,
                        block,
                        settingsFromForm(
                          block.type,
                          new FormData(event.currentTarget),
                        ),
                      )
                    }
                  >
                    {renderSettingsFields(block)}
                    <button
                      className="button button-secondary"
                      disabled={busy || !canEdit}
                    >
                      Salvar
                    </button>
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
