"use client";

import { useState, type DragEvent } from "react";
import {
  HiOutlineBars3,
  HiOutlineCalendarDays,
  HiOutlineChatBubbleLeftRight,
  HiOutlineDocumentArrowDown,
  HiOutlineDocumentText,
  HiOutlineEllipsisVertical,
  HiOutlineEnvelope,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineLink,
  HiOutlineMusicalNote,
  HiOutlinePhone,
  HiOutlinePhoto,
  HiOutlinePlay,
  HiOutlineQrCode,
  HiOutlineShoppingBag,
} from "react-icons/hi2";

export type SmartPageBlockType =
  | "link"
  | "product"
  | "title"
  | "text"
  | "divider"
  | "image"
  | "video"
  | "spotify"
  | "file"
  | "qr"
  | "whatsapp"
  | "email"
  | "phone"
  | "event"
  | "appointment";

export interface SmartPageContentBlock {
  id: string;
  type: SmartPageBlockType;
  position: number;
  settings: {
    title?: string;
    text?: string;
    content?: string;
    alt?: string;
    label?: string;
    number?: string;
    address?: string;
    imageUrl?: string;
    url?: string;
    destinationUrl?: string;
    date?: string;
    message?: string;
    subject?: string;
    style?: "solid" | "dashed" | "dotted";
    level?: "h2" | "h3";
    alignment?: "left" | "center" | "right";
    openInNewTab?: boolean;
    buttonLabel?: string;
  };
  visible: boolean;
  analyticsEnabled: boolean;
  linkId?: string | null;
  link: {
    slug: string;
    domainKey: string;
    isActive: boolean;
    expiresAt: string | null;
  } | null;
  productId?: string | null;
  product?: { id: string; name: string } | null;
}

function secondaryLabel(block: SmartPageContentBlock) {
  if (block.type === "product") return "Produto";
  if (block.type === "divider") return "Separador";
  if (block.type === "title") return "Título";
  if (block.type === "text") return "Texto";
  if (block.type === "image") return "Imagem";
  if (block.type === "video") return "Vídeo do YouTube";
  if (block.type === "spotify") return "Spotify";
  if (block.type === "file") return "Arquivo";
  if (block.type === "qr") return "QR Code";
  if (block.type === "whatsapp") return "Contato pelo WhatsApp";
  if (block.type === "email") return "Contato por e-mail";
  if (block.type === "phone") return "Contato por telefone";
  if (block.type === "event") return block.settings.date || "Evento";
  if (block.type === "appointment") return "Agendamento";
  if (block.link) return `${block.link.domainKey}/${block.link.slug}`;
  return block.settings.destinationUrl?.replace(/^https?:\/\//, "") ?? "Sem destino";
}

function blockTitle(block: SmartPageContentBlock) {
  if (block.type === "product")
    return block.product?.name ?? "Produto indisponível";
  if (block.type === "title") return block.settings.text ?? "Título";
  if (block.type === "text") return block.settings.content ?? "Texto";
  if (block.type === "divider") return "Separador";
  if (block.type === "image") return block.settings.alt || "Imagem";
  if (block.type === "video" || block.type === "spotify")
    return block.settings.title ?? "Mídia";
  if (block.type === "file") return block.settings.title ?? "Arquivo";
  if (block.type === "qr") return block.settings.title ?? "QR Code";
  if (block.type === "whatsapp" || block.type === "phone")
    return block.settings.label ?? block.settings.number ?? "Contato";
  if (block.type === "email")
    return block.settings.label ?? block.settings.address ?? "E-mail";
  if (block.type === "event" || block.type === "appointment")
    return block.settings.title ?? "Evento";
  return block.settings.title ?? "Link sem título";
}

export function ContentBlock({
  block,
  index,
  disabled = false,
  isDragging = false,
  isDropTarget = false,
  onEdit,
  onToggle,
  onDelete,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  block: SmartPageContentBlock;
  index: number;
  disabled?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onEdit: (block: SmartPageContentBlock) => void;
  onToggle: (block: SmartPageContentBlock) => void;
  onDelete: (block: SmartPageContentBlock) => void;
  onMove: (block: SmartPageContentBlock, direction: -1 | 1) => void;
  onDragStart: (event: DragEvent<HTMLElement>, blockId: string) => void;
  onDragOver: (event: DragEvent<HTMLElement>, blockId: string) => void;
  onDrop: (event: DragEvent<HTMLElement>, blockId: string) => void;
  onDragEnd: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon =
    block.type === "product"
      ? HiOutlineShoppingBag
      : block.type === "title" || block.type === "text" || block.type === "divider"
        ? HiOutlineDocumentText
        : block.type === "image"
          ? HiOutlinePhoto
          : block.type === "video"
            ? HiOutlinePlay
            : block.type === "spotify"
              ? HiOutlineMusicalNote
              : block.type === "file"
                ? HiOutlineDocumentArrowDown
                : block.type === "qr"
                  ? HiOutlineQrCode
                  : block.type === "whatsapp"
                    ? HiOutlineChatBubbleLeftRight
                    : block.type === "email"
                      ? HiOutlineEnvelope
                      : block.type === "phone"
                        ? HiOutlinePhone
                        : block.type === "event" || block.type === "appointment"
                          ? HiOutlineCalendarDays
                          : HiOutlineLink;
  const title = blockTitle(block);

  return (
    <article
      className={`sp-content-block${block.visible ? "" : " is-hidden"}${isDragging ? " is-dragging" : ""}${isDropTarget ? " is-drop-target" : ""}`}
      draggable={!disabled}
      onDragStart={(event) => {
        if (
          !(event.target instanceof Element) ||
          !event.target.closest(".sp-content-block-handle")
        ) {
          event.preventDefault();
          return;
        }
        onDragStart(event, block.id);
      }}
      onDragOver={(event) => onDragOver(event, block.id)}
      onDrop={(event) => onDrop(event, block.id)}
      onDragEnd={onDragEnd}
      aria-label={`${title}, ${block.visible ? "ativo" : "oculto"}`}
    >
      <button
        type="button"
        className="sp-content-block-handle"
        aria-label={`Arrastar ${title}`}
        title="Arraste para reorganizar"
        disabled={disabled}
        draggable={!disabled}
        onClick={() => onEdit(block)}
      >
        <HiOutlineBars3 aria-hidden="true" />
      </button>
      <button
        type="button"
        className="sp-content-block-summary"
        disabled={disabled}
        onClick={() => onEdit(block)}
      >
        <span className="sp-content-block-icon" aria-hidden="true">
          <Icon />
        </span>
        <span>
          <strong>{title}</strong>
          <small>{secondaryLabel(block)}</small>
        </span>
      </button>
      <button
        type="button"
        className="sp-content-block-toggle"
        disabled={disabled}
        aria-pressed={block.visible}
        aria-label={`${block.visible ? "Ocultar" : "Ativar"} ${title}`}
        onClick={() => onToggle(block)}
      >
        {block.visible ? <HiOutlineEye aria-hidden="true" /> : <HiOutlineEyeSlash aria-hidden="true" />}
        <span>{block.visible ? "Ativo" : "Oculto"}</span>
      </button>
      <div className="sp-content-block-menu">
        <button
          type="button"
          className="sp-content-block-menu-trigger"
          disabled={disabled}
          aria-label={`Mais ações para ${title}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <HiOutlineEllipsisVertical aria-hidden="true" />
        </button>
        {menuOpen && (
          <div role="menu" className="sp-content-block-menu-items">
            <button type="button" role="menuitem" onClick={() => onEdit(block)}>
              Editar
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => onToggle(block)}
            >
              {block.visible ? "Ocultar" : "Ativar"}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={disabled || index === 0}
              onClick={() => onMove(block, -1)}
            >
              Mover acima
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => onMove(block, 1)}
            >
              Mover abaixo
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger-text"
              onClick={() => onDelete(block)}
            >
              Excluir
            </button>
          </div>
        )}
      </div>
    </article>
  );
}