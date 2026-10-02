"use client";

import { useState, type DragEvent } from "react";
import {
  HiOutlineBars3,
  HiOutlineEllipsisVertical,
  HiOutlineEye,
  HiOutlineEyeSlash,
  HiOutlineLink,
  HiOutlineShoppingBag,
} from "react-icons/hi2";

export interface SmartPageContentBlock {
  id: string;
  type: "link" | "product";
  position: number;
  settings: {
    title?: string;
    destinationUrl?: string;
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
  if (block.link) return `${block.link.domainKey}/${block.link.slug}`;
  return block.settings.destinationUrl?.replace(/^https?:\/\//, "") ?? "Sem destino";
}

export function ContentBlock({
  block,
  index,
  disabled = false,
  onEdit,
  onToggle,
  onDelete,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  block: SmartPageContentBlock;
  index: number;
  disabled?: boolean;
  onEdit: (block: SmartPageContentBlock) => void;
  onToggle: (block: SmartPageContentBlock) => void;
  onDelete: (block: SmartPageContentBlock) => void;
  onMove: (block: SmartPageContentBlock, direction: -1 | 1) => void;
  onDragStart: (event: DragEvent<HTMLElement>, blockId: string) => void;
  onDragOver: (event: DragEvent<HTMLElement>, blockId: string) => void;
  onDrop: (event: DragEvent<HTMLElement>, blockId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = block.type === "product" ? HiOutlineShoppingBag : HiOutlineLink;
  const title =
    block.type === "product"
      ? (block.product?.name ?? "Produto indisponível")
      : (block.settings.title ?? "Link sem título");

  return (
    <article
      className={`sp-content-block${block.visible ? "" : " is-hidden"}`}
      draggable={!disabled}
      onDragStart={(event) => onDragStart(event, block.id)}
      onDragOver={(event) => onDragOver(event, block.id)}
      onDrop={(event) => onDrop(event, block.id)}
      aria-label={`${title}, ${block.visible ? "ativo" : "oculto"}`}
    >
      <button
        type="button"
        className="sp-content-block-handle"
        aria-label={`Arrastar ${title}`}
        title="Arraste para reorganizar"
        disabled={disabled}
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