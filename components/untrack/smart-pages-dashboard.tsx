"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CopyButton } from "@/components/copy-button";
import { ActionStatus, apiRequest, useAction } from "./shared";

import { PageDesign } from "@/components/smart-pages/page-design";
import { ThemeGallery } from "@/components/smart-pages/theme-gallery";
import type { SmartPageTheme } from "@/modules/smart-pages/themes";

type PageStatus = "draft" | "published";
type SocialNetwork =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "x"
  | "facebook"
  | "whatsapp"
  | "website";

const socialNetworks: { value: SocialNetwork; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Site" },
];

interface SmartPageSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  avatarUrl: string | null;
  theme: SmartPageTheme;
  socialLinks: { network: SocialNetwork; url: string }[];
  status: PageStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { blocks: number };
}

interface SmartPageBlock {
  id: string;
  type: "link";
  position: number;
  settings: {
    title: string;
    destinationUrl?: string;
    openInNewTab: boolean;
  };
  visible: boolean;
  analyticsEnabled: boolean;
  linkId: string | null;
  link: {
    slug: string;
    domainKey: string;
    isActive: boolean;
    expiresAt: string | null;
  } | null;
}

interface SmartPageDetail extends SmartPageSummary {
  blocks: SmartPageBlock[];
}

interface ManagedLink {
  id: string;
  title: string;
  slug: string;
  destinationUrl: string;
}

interface SmartPageMetrics {
  periodDays: number;
  views: number;
  uniqueVisitors: number;
  clicks: number;
  ctr: number;
  topLinks: { blockId: string; title: string; clicks: number }[];
  trafficSources: { name: string; views: number }[];
  devices: { name: string; views: number }[];
}

function publicUrl(slug: string) {
  return `/page/${encodeURIComponent(slug)}`;
}

function SmartPagePreview({ page }: { page: SmartPageDetail }) {
  const visible = page.blocks.filter(
    (block) =>
      block.visible &&
      (!block.link ||
        (block.link.isActive &&
          (!block.link.expiresAt ||
            new Date(block.link.expiresAt) > new Date()))),
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
          <span key={block.id}>{block.settings.title}</span>
        ))}
        {!visible.length && <p>Adicione seu primeiro link.</p>}
      </PageDesign>
    </div>
  );
}

export function SmartPagesDashboard({
  initial,
  managedLinks,
  canEdit = true,
  publicOrigin = "",
}: {
  initial: { items: SmartPageSummary[]; page: number; hasMore: boolean };
  managedLinks: ManagedLink[];
  canEdit?: boolean;
  publicOrigin?: string;
}) {
  const [pages, setPages] = useState(initial.items);
  const [selected, setSelected] = useState<SmartPageDetail | null>(null);
  const [editorTab, setEditorTab] = useState<"editor" | "preview">("editor");
  const [metrics, setMetrics] = useState<SmartPageMetrics | null>(null);
  const action = useAction();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [listPage, setListPage] = useState(initial.page);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [showCreate, setShowCreate] = useState(initial.items.length === 0);
  const [profileDraft, setProfileDraft] = useState<Partial<SmartPageSummary>>(
    {},
  );
  const [dirty, setDirty] = useState(false);
  const [dirtyBlocks, setDirtyBlocks] = useState<string[]>([]);
  const editorRef = useRef<HTMLHeadingElement>(null);
  const hasUnsaved = dirty || dirtyBlocks.length > 0;
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);
  async function loadPages(page: number, query = appliedSearch) {
    await action.run(async () => {
      const data = await apiRequest<typeof initial>(
        `/api/smart-pages?page=${page}&search=${encodeURIComponent(query)}`,
      );
      setPages(data.items);
      setListPage(data.page);
      setHasMore(data.hasMore);
      setAppliedSearch(query);
    });
  }
  function profileChanged(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    setDirty(true);
    setProfileDraft({
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      avatarUrl: String(data.get("avatarUrl") ?? "") || null,
      theme: profileDraft.theme ?? selected?.theme ?? { preset: "minimal" },
      socialLinks: socialNetworks.flatMap(({ value }) => {
        const url = String(data.get(`social-${value}`) ?? "").trim();
        return url ? [{ network: value, url }] : [];
      }),
    });
  }

  async function selectPage(id: string) {
    if (
      action.busy ||
      (hasUnsaved &&
        !window.confirm(
          "Há alterações não salvas. Deseja descartá-las e trocar de página?",
        ))
    )
      return;
    await action.run(async () => {
      const page = await apiRequest<SmartPageDetail>(`/api/smart-pages/${id}`);
      setSelected({
        ...page,
        theme: page.theme ?? { preset: "minimal" },
        socialLinks: page.socialLinks ?? [],
      });
      setProfileDraft({});
      setDirty(false);
      setDirtyBlocks([]);
      setShowCreate(false);
      requestAnimationFrame(() => editorRef.current?.focus());
      setMetrics(null);
      setEditorTab("editor");
    });
  }

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !canEdit ||
      (hasUnsaved &&
        !window.confirm(
          "Descartar alterações não salvas para criar outra página?",
        ))
    )
      return;
    const form = event.currentTarget;
    const data = new FormData(form);
    await action.run(async () => {
      const page = await apiRequest<SmartPageDetail>("/api/smart-pages", {
        method: "POST",
        body: JSON.stringify({
          slug: data.get("slug"),
          title: data.get("title"),
          description: data.get("description"),
        }),
      });
      setPages((current) => [page, ...current]);
      setSelected({ ...page, blocks: [] });
      setMetrics(null);
      setProfileDraft({});
      setDirty(false);
      setDirtyBlocks([]);
      setShowCreate(false);
      action.setNotice(
        "Rascunho criado. Adicione seus links e publique quando estiver pronto.",
      );
      form.reset();
    });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const socialLinks = socialNetworks.flatMap(({ value }) => {
      const url = String(data.get(`social-${value}`) ?? "").trim();
      return url ? [{ network: value, url }] : [];
    });
    await action.run(async () => {
      const page = await apiRequest<SmartPageDetail>(
        `/api/smart-pages/${selected.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            slug: data.get("slug"),
            title: data.get("title"),
            description: data.get("description"),
            avatarUrl: data.get("avatarUrl") || null,
            theme: profileDraft.theme ?? selected.theme,
            socialLinks,
          }),
        },
      );
      setSelected((current) => (current ? { ...current, ...page } : current));
      setPages((current) =>
        current.map((item) =>
          item.id === page.id ? { ...item, ...page } : item,
        ),
      );
      setProfileDraft({});
      setDirty(false);
      action.setNotice("Perfil salvo.");
    });
  }

  async function addBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    await action.run(async () => {
      const block = await apiRequest<SmartPageBlock>(
        `/api/smart-pages/${selected.id}/blocks`,
        {
          method: "POST",
          body: JSON.stringify({
            type: "link",
            linkId: data.get("linkId") || null,
            settings: {
              title: data.get("title"),
              destinationUrl: data.get("destinationUrl") || undefined,
              openInNewTab: data.get("openInNewTab") === "on",
            },
          }),
        },
      );
      setSelected((current) =>
        current ? { ...current, blocks: [...current.blocks, block] } : current,
      );
      form.reset();
      action.setNotice("Link adicionado.");
    });
  }

  async function saveBlock(
    event: FormEvent<HTMLFormElement>,
    block: SmartPageBlock,
  ) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    await action.run(async () => {
      const updated = await apiRequest<SmartPageBlock>(
        `/api/smart-pages/${selected.id}/blocks/${block.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            type: "link",
            linkId: data.get("linkId") || null,
            visible: data.get("visible") === "on",
            analyticsEnabled: data.get("analyticsEnabled") === "on",
            settings: {
              title: data.get("title"),
              destinationUrl: data.get("destinationUrl") || undefined,
              openInNewTab: data.get("openInNewTab") === "on",
            },
          }),
        },
      );
      setSelected((current) =>
        current
          ? {
              ...current,
              blocks: current.blocks.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      );
      setDirtyBlocks((ids) => ids.filter((id) => id !== block.id));
      action.setNotice("Link atualizado.");
    });
  }

  async function deleteBlock(blockId: string) {
    if (!selected || !window.confirm("Excluir este link da Smart Page?"))
      return;
    await action.run(async () => {
      await apiRequest(`/api/smart-pages/${selected.id}/blocks/${blockId}`, {
        method: "DELETE",
      });
      setSelected((current) =>
        current
          ? {
              ...current,
              blocks: current.blocks.filter((block) => block.id !== blockId),
            }
          : current,
      );
      setDirtyBlocks((ids) => ids.filter((id) => id !== blockId));
      action.setNotice("Link excluído.");
    });
  }

  async function moveBlock(blockId: string, direction: -1 | 1) {
    if (!selected) return;
    const position = selected.blocks.findIndex((block) => block.id === blockId);
    const destination = position + direction;
    if (destination < 0 || destination >= selected.blocks.length) return;
    const blocks = [...selected.blocks];
    [blocks[position], blocks[destination]] = [
      blocks[destination],
      blocks[position],
    ];
    await action.run(async () => {
      await apiRequest(`/api/smart-pages/${selected.id}/blocks`, {
        method: "PATCH",
        body: JSON.stringify({ blockIds: blocks.map((block) => block.id) }),
      });
      setSelected((current) => (current ? { ...current, blocks } : current));
    });
  }

  async function setPublished(published: boolean) {
    if (!selected || !canEdit || hasUnsaved) return;
    if (
      !published &&
      !window.confirm(
        "Despublicar esta página? O endereço público ficará indisponível até você publicar novamente.",
      )
    )
      return;
    await action.run(async () => {
      const page = await apiRequest<SmartPageDetail>(
        `/api/smart-pages/${selected.id}/publish`,
        {
          method: "POST",
          body: JSON.stringify({ published }),
        },
      );
      setSelected((current) => (current ? { ...current, ...page } : current));
      setPages((current) =>
        current.map((item) =>
          item.id === page.id ? { ...item, ...page } : item,
        ),
      );
      action.setNotice(
        published ? "Página publicada." : "Página despublicada.",
      );
    });
  }

  async function loadMetrics() {
    if (!selected) return;
    await action.run(async () => {
      const result = await apiRequest<SmartPageMetrics>(
        `/api/smart-pages/${selected.id}/analytics?days=30`,
      );
      setMetrics(result);
    });
  }

  return (
    <section className="smart-pages-dashboard">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">Untrack</span>
          <h1>Smart Pages</h1>
          <p className="muted">
            Páginas públicas para organizar, compartilhar e entender seus links.
          </p>
        </div>
        {canEdit && (
          <button
            className="button"
            disabled={action.busy}
            onClick={() => setShowCreate((open) => !open)}
          >
            {showCreate ? "Fechar nova página" : "+ Nova página"}
          </button>
        )}
      </div>
      <div className="smart-page-feedback">
        <ActionStatus {...action} />
        {!canEdit && (
          <p className="smart-page-readonly">
            Você tem acesso de leitura. Peça a um editor ou administrador para
            alterar páginas.
          </p>
        )}
      </div>
      <div className="smart-pages-grid">
        <aside className="smart-pages-sidebar" aria-label="Suas Smart Pages">
          {canEdit && showCreate && (
            <form className="smart-page-create" onSubmit={createPage}>
              <h2>Nova página</h2>
              <label>
                Nome ou marca
                <input required name="title" maxLength={120} />
              </label>
              <label>
                Slug
                <input
                  required
                  name="slug"
                  minLength={3}
                  maxLength={60}
                  pattern="[a-z0-9-]+"
                />
              </label>
              <label>
                Descrição curta
                <textarea name="description" maxLength={500} rows={3} />
              </label>
              <button className="button" disabled={action.busy}>
                Criar página
              </button>
            </form>
          )}
          <div className="smart-page-list">
            <h2>Suas páginas</h2>
            <form
              className="smart-page-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                void loadPages(1, search);
              }}
            >
              <label>
                Buscar por nome ou endereço
                <input
                  type="search"
                  value={search}
                  maxLength={120}
                  placeholder="Encontre uma página..."
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <button
                className="button button-secondary"
                disabled={action.busy}
              >
                Buscar
              </button>
            </form>
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                className={
                  selected?.id === page.id
                    ? "smart-page-list-item active"
                    : "smart-page-list-item"
                }
                disabled={action.busy}
                aria-pressed={selected?.id === page.id}
                onClick={() => void selectPage(page.id)}
              >
                <strong>{page.title}</strong>
                <span>
                  /{page.slug} ·{" "}
                  {page.status === "published" ? "Publicada" : "Rascunho"}
                </span>
              </button>
            ))}
            {!pages.length ? (
              <p className="muted">
                {appliedSearch
                  ? "Nenhuma página encontrada. Tente outro nome ou endereço."
                  : "Nenhuma página neste workspace. Crie a primeira para começar."}
              </p>
            ) : null}
            {(hasMore || listPage > 1) && (
              <div className="smart-page-pagination">
                <button
                  className="button button-secondary"
                  disabled={action.busy || listPage === 1}
                  onClick={() => void loadPages(listPage - 1)}
                >
                  Anterior
                </button>
                <span>Página {listPage}</span>
                <button
                  className="button button-secondary"
                  disabled={action.busy || !hasMore}
                  onClick={() => void loadPages(listPage + 1)}
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </aside>

        <div className="smart-page-workbench" aria-busy={action.busy}>
          <div
            className="smart-page-mobile-tabs"
            aria-label="Editor da Smart Page"
          >
            <button
              type="button"
              aria-pressed={editorTab === "editor"}
              onClick={() => setEditorTab("editor")}
            >
              Editor
            </button>
            <button
              type="button"
              aria-pressed={editorTab === "preview"}
              onClick={() => setEditorTab("preview")}
            >
              Prévia
            </button>
          </div>
          {!selected ? (
            <div className="smart-page-editor-empty">
              <span className="smart-page-empty-icon" aria-hidden="true">
                ↗
              </span>
              <h2>
                {pages.length
                  ? "Qual página vamos trabalhar?"
                  : "Seus links, em um só lugar"}
              </h2>
              <p>
                {pages.length
                  ? "Escolha uma página na lista para editar o perfil, organizar os links e acompanhar os resultados."
                  : "Crie um rascunho, adicione seus links e confira a prévia antes de publicar."}
              </p>
            </div>
          ) : (
            <>
              <div
                key={selected.id}
                className={
                  editorTab === "preview"
                    ? "smart-page-editor mobile-hidden"
                    : "smart-page-editor"
                }
              >
                <div className="smart-page-editor-heading">
                  <div>
                    <span
                      className={
                        selected.status === "published"
                          ? "success-badge"
                          : "inactive-badge"
                      }
                    >
                      {selected.status === "published"
                        ? "Publicada"
                        : "Rascunho"}
                    </span>
                    <h2 ref={editorRef} tabIndex={-1}>
                      {selected.title}
                    </h2>
                    <p>/page/{selected.slug}</p>
                    <p className="smart-page-save-status" role="status">
                      {hasUnsaved
                        ? "Alterações não salvas — salve antes de publicar ou trocar de página."
                        : "Todas as alterações salvas"}
                    </p>
                  </div>
                  <div className="action-row">
                    {selected.status === "published" && (
                      <a
                        className="button button-secondary"
                        href={publicUrl(selected.slug)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir página
                      </a>
                    )}
                    {selected.status === "published" && (
                      <CopyButton
                        value={`${publicOrigin}${publicUrl(selected.slug)}`}
                        label="Copiar endereço"
                      />
                    )}
                    <button
                      className="button"
                      disabled={action.busy || !canEdit || hasUnsaved}
                      onClick={() =>
                        void setPublished(selected.status !== "published")
                      }
                    >
                      {selected.status === "published"
                        ? "Despublicar"
                        : "Publicar"}
                    </button>
                  </div>
                </div>

                <form
                  className="smart-page-profile-form"
                  onSubmit={saveProfile}
                  onChange={profileChanged}
                >
                  <fieldset
                    className="smart-page-form-fields"
                    disabled={!canEdit || action.busy}
                  >
                    <legend>Perfil</legend>
                    <label>
                      Nome
                      <input
                        required
                        name="title"
                        maxLength={120}
                        defaultValue={selected.title}
                      />
                    </label>
                    <label>
                      Descrição
                      <textarea
                        name="description"
                        maxLength={500}
                        rows={3}
                        defaultValue={selected.description}
                      />
                    </label>
                    <label>
                      Avatar (URL)
                      <input
                        type="url"
                        name="avatarUrl"
                        defaultValue={selected.avatarUrl ?? ""}
                      />
                    </label>
                    <label>
                      Endereço da página
                      <input
                        required
                        name="slug"
                        minLength={3}
                        maxLength={60}
                        pattern="[a-z0-9-]+"
                        defaultValue={selected.slug}
                      />
                    </label>
                    <ThemeGallery
                      value={profileDraft.theme ?? selected.theme}
                      disabled={!canEdit || action.busy}
                      onChange={(theme) => {
                        setProfileDraft((current) => ({ ...current, theme }));
                        setDirty(true);
                      }}
                    />
                    <details className="smart-page-social-details">
                      <summary>Redes sociais (opcional)</summary>
                      <fieldset className="smart-page-social-inputs">
                        <legend>Redes sociais</legend>
                        {socialNetworks.map((network) => (
                          <label key={network.value}>
                            {network.label}
                            <input
                              type="url"
                              name={`social-${network.value}`}
                              placeholder="https://"
                              defaultValue={
                                selected.socialLinks.find(
                                  (social) => social.network === network.value,
                                )?.url ?? ""
                              }
                            />
                          </label>
                        ))}
                      </fieldset>
                    </details>
                    <button
                      className="button button-secondary"
                      disabled={action.busy}
                    >
                      Salvar perfil
                    </button>
                  </fieldset>
                </form>

                <section
                  className="smart-page-block-editor"
                  aria-labelledby="smart-page-content-heading"
                >
                  <h3 id="smart-page-content-heading">Conteúdo</h3>
                  <p className="muted">
                    Use uma URL externa ou selecione um link gerenciado. Você
                    pode reordenar os links abaixo.
                  </p>
                  <fieldset
                    className="smart-page-form-fields"
                    disabled={!canEdit || action.busy}
                  >
                    <form className="smart-page-add-block" onSubmit={addBlock}>
                      <label>
                        Título
                        <input
                          required
                          name="title"
                          maxLength={120}
                          placeholder="Meu portfólio"
                        />
                      </label>
                      <label>
                        URL externa
                        <input
                          type="url"
                          name="destinationUrl"
                          placeholder="https://exemplo.com"
                        />
                      </label>
                      <label>
                        Link gerenciado
                        <select name="linkId" defaultValue="">
                          <option value="">Nenhum</option>
                          {managedLinks.map((link) => (
                            <option key={link.id} value={link.id}>
                              {link.title || link.slug}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="smart-page-check">
                        <input
                          type="checkbox"
                          name="openInNewTab"
                          defaultChecked
                        />{" "}
                        Abrir em nova aba
                      </label>
                      <button className="button" disabled={action.busy}>
                        Adicionar link
                      </button>
                    </form>
                    <ol className="smart-page-block-list">
                      {selected.blocks.map((block, index) => (
                        <li
                          key={`${block.id}:${block.settings.title}:${block.visible}:${block.linkId}`}
                        >
                          <form
                            onChange={() =>
                              setDirtyBlocks((ids) =>
                                ids.includes(block.id)
                                  ? ids
                                  : [...ids, block.id],
                              )
                            }
                            onSubmit={(event) => saveBlock(event, block)}
                          >
                            <label>
                              Título
                              <input
                                required
                                name="title"
                                maxLength={120}
                                defaultValue={block.settings.title}
                              />
                            </label>
                            <label>
                              URL externa
                              <input
                                type="url"
                                name="destinationUrl"
                                defaultValue={
                                  block.settings.destinationUrl ?? ""
                                }
                              />
                            </label>
                            <label>
                              Link gerenciado
                              <select
                                name="linkId"
                                defaultValue={block.linkId ?? ""}
                              >
                                <option value="">Nenhum</option>
                                {managedLinks.map((link) => (
                                  <option key={link.id} value={link.id}>
                                    {link.title || link.slug}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="smart-page-block-options">
                              <label className="smart-page-check">
                                <input
                                  type="checkbox"
                                  name="visible"
                                  defaultChecked={block.visible}
                                />{" "}
                                Visível
                              </label>
                              <label className="smart-page-check">
                                <input
                                  type="checkbox"
                                  name="analyticsEnabled"
                                  defaultChecked={block.analyticsEnabled}
                                />{" "}
                                Medir cliques
                              </label>
                              <label className="smart-page-check">
                                <input
                                  type="checkbox"
                                  name="openInNewTab"
                                  defaultChecked={block.settings.openInNewTab}
                                />{" "}
                                Nova aba
                              </label>
                            </div>
                            <div className="action-row">
                              <button
                                className="button button-secondary"
                                disabled={action.busy}
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                className="button button-quiet"
                                disabled={action.busy || index === 0}
                                onClick={() => void moveBlock(block.id, -1)}
                              >
                                Mover acima
                              </button>
                              <button
                                type="button"
                                className="button button-quiet"
                                disabled={
                                  action.busy ||
                                  index === selected.blocks.length - 1
                                }
                                onClick={() => void moveBlock(block.id, 1)}
                              >
                                Mover abaixo
                              </button>
                              <button
                                type="button"
                                className="button button-quiet danger-text"
                                disabled={action.busy}
                                onClick={() => void deleteBlock(block.id)}
                              >
                                Excluir
                              </button>
                            </div>
                          </form>
                        </li>
                      ))}
                    </ol>
                  </fieldset>
                </section>
                <section
                  className="smart-page-metrics"
                  aria-labelledby="smart-page-analytics-heading"
                >
                  <div className="smart-page-metrics-heading">
                    <div>
                      <h3 id="smart-page-analytics-heading">Analytics</h3>
                      <p>Últimos 30 dias</p>
                    </div>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={action.busy}
                      onClick={() => void loadMetrics()}
                    >
                      Atualizar métricas
                    </button>
                  </div>
                  {!metrics ? (
                    <p className="muted">
                      Carregue as métricas para ver o desempenho da página.
                    </p>
                  ) : (
                    <>
                      <div className="stats-grid smart-page-stats">
                        <div>
                          <strong>{metrics.views}</strong>
                          <span>Visualizações</span>
                        </div>
                        <div>
                          <strong>{metrics.uniqueVisitors}</strong>
                          <span>Visitantes únicos</span>
                        </div>
                        <div>
                          <strong>{metrics.clicks}</strong>
                          <span>Clicks</span>
                        </div>
                        <div>
                          <strong>{metrics.ctr}%</strong>
                          <span>CTR</span>
                        </div>
                      </div>
                      <div className="smart-page-metric-lists">
                        <div>
                          <h4>Links com mais clicks</h4>
                          <ul>
                            {metrics.topLinks.map((link) => (
                              <li key={link.blockId}>
                                <span>{link.title}</span>
                                <strong>{link.clicks}</strong>
                              </li>
                            ))}
                            {!metrics.topLinks.length ? (
                              <li>Sem clicks ainda.</li>
                            ) : null}
                          </ul>
                        </div>
                        <div>
                          <h4>Origens</h4>
                          <ul>
                            {metrics.trafficSources.map((source) => (
                              <li key={source.name}>
                                <span>{source.name}</span>
                                <strong>{source.views}</strong>
                              </li>
                            ))}
                            {!metrics.trafficSources.length ? (
                              <li>Sem visitas ainda.</li>
                            ) : null}
                          </ul>
                        </div>
                        <div>
                          <h4>Dispositivos</h4>
                          <ul>
                            {metrics.devices.map((device) => (
                              <li key={device.name}>
                                <span>{device.name}</span>
                                <strong>{device.views}</strong>
                              </li>
                            ))}
                            {!metrics.devices.length ? (
                              <li>Sem visitas ainda.</li>
                            ) : null}
                          </ul>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              </div>
              <div
                className={
                  editorTab === "editor"
                    ? "smart-page-preview-panel mobile-hidden"
                    : "smart-page-preview-panel"
                }
              >
                <h2>Prévia</h2>
                <p className="muted">
                  {dirty
                    ? "Prévia das alterações do perfil. Salve para atualizar sua página."
                    : "Confira a aparência antes de compartilhar."}
                </p>
                <SmartPagePreview page={{ ...selected, ...profileDraft }} />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
