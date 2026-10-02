"use client";

import { useEffect, useState, type FormEvent } from "react";
import { HiOutlineLink, HiOutlineShoppingBag, HiOutlineXMark } from "react-icons/hi2";
import { BlockDestinationFields } from "@/components/smart-pages/block-destination-fields";
import { SmartField } from "@/components/smart-pages/smart-form";

type ContentKind = "link" | "product" | "create-product";

export function AddContentModal({
  open,
  links,
  products,
  busy,
  failure,
  onClose,
  onAddLink,
  onAddProduct,
  onCreateProduct,
}: {
  open: boolean;
  links: { id: string; title: string | null; slug: string }[];
  products: { id: string; name: string; status: "draft" | "active" | "archived" }[];
  busy: boolean;
  failure: string;
  onClose: () => void;
  onAddLink: (event: FormEvent<HTMLFormElement>) => void;
  onAddProduct: (event: FormEvent<HTMLFormElement>) => void;
  onCreateProduct: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [kind, setKind] = useState<ContentKind>("link");

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <div className="sp-add-content-layer" role="presentation">
      <button
        type="button"
        className="sp-add-content-backdrop"
        aria-label="Fechar adicionar conteúdo"
        disabled={busy}
        onClick={onClose}
      />
      <section
        className="sp-add-content-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sp-add-content-title"
      >
        <header>
          <div>
            <span>CONTEÚDO</span>
            <h2 id="sp-add-content-title">Adicionar conteúdo</h2>
          </div>
          <button
            type="button"
            className="sp-add-content-close"
            aria-label="Fechar"
            disabled={busy}
            onClick={onClose}
          >
            <HiOutlineXMark aria-hidden="true" />
          </button>
        </header>
        <div className="sp-add-content-types" role="tablist" aria-label="Tipo de conteúdo">
          <button
            type="button"
            role="tab"
            aria-selected={kind === "link"}
            onClick={() => setKind("link")}
          >
            <HiOutlineLink aria-hidden="true" />
            Link
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "product"}
            onClick={() => setKind("product")}
          >
            <HiOutlineShoppingBag aria-hidden="true" />
            Produto
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "create-product"}
            onClick={() => setKind("create-product")}
          >
            <HiOutlineShoppingBag aria-hidden="true" />
            Novo produto
          </button>
        </div>
        {failure && <p className="sp-add-content-error" role="alert">{failure}</p>}
        {kind === "link" ? (
          <form className="sp-add-content-form" noValidate onSubmit={onAddLink}>
            <SmartField>
              Título
              <input required name="title" maxLength={120} placeholder="Meu portfólio" autoFocus />
            </SmartField>
            <BlockDestinationFields links={links} />
            <SmartField className="smart-page-check">
              <input type="checkbox" name="openInNewTab" defaultChecked /> Abrir em nova aba
            </SmartField>
            <button className="button" disabled={busy}>
              Adicionar link
            </button>
          </form>
        ) : kind === "product" ? (
          <form className="sp-add-content-form" noValidate onSubmit={onAddProduct}>
            {products.some((product) => product.status !== "archived") ? (
              <>
                <SmartField>
                  Produto
                  <select required name="productId" defaultValue="">
                    <option value="" disabled>
                      Selecione um produto
                    </option>
                    {products
                      .filter((product) => product.status !== "archived")
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {product.status === "draft" ? " (rascunho)" : ""}
                        </option>
                      ))}
                  </select>
                </SmartField>
                <SmartField>
                  Texto do botão
                  <input name="buttonLabel" maxLength={40} defaultValue="Ver produto" />
                </SmartField>
                <button className="button" disabled={busy}>
                  Adicionar produto
                </button>
              </>
            ) : (
              <p className="sp-add-content-empty">
                Sua loja ainda não tem produtos disponíveis para adicionar.
              </p>
            )}
          </form>
        ) : (
          <form className="sp-add-content-form" noValidate onSubmit={onCreateProduct}>
            <SmartField>
              Nome do produto
              <input required name="name" maxLength={120} autoFocus />
            </SmartField>
            <SmartField>
              Endereço do produto
              <input
                required
                name="slug"
                minLength={3}
                maxLength={140}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
            </SmartField>
            <SmartField>
              Tipo
              <select name="type" defaultValue="digital">
                <option value="digital">Produto digital</option>
                <option value="physical">Produto físico</option>
                <option value="course">Curso</option>
                <option value="booking">Agendamento</option>
              </select>
            </SmartField>
            <SmartField>
              Preço (R$)
              <input required name="price" type="number" min="0" max="9999999.99" step="0.01" />
            </SmartField>
            <SmartField>
              Status
              <select name="status" defaultValue="draft">
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
              </select>
            </SmartField>
            <button className="button" disabled={busy}>
              Criar produto
            </button>
          </form>
        )}
      </section>
    </div>
  );
}