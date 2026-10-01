"use client";

import { useState, type FormEvent } from "react";
import { ActionStatus, apiRequest, useAction } from "./shared";

type PageStatus = "draft" | "published";

interface SmartPageSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  avatarUrl: string | null;
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
  return (
    <div className="smart-page-preview" aria-label="Prévia da Smart Page">
      <div className="smart-page-preview-profile">
        {page.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.avatarUrl} alt="" width={72} height={72} />
        ) : (
          <span aria-hidden="true">{page.title.slice(0, 1).toUpperCase()}</span>
        )}
        <strong>{page.title}</strong>
        {page.description ? <small>{page.description}</small> : null}
      </div>
      <div className="smart-page-preview-links">
        {page.blocks
          .filter((block) => block.visible)
          .map((block) => (
            <span key={block.id}>{block.settings.title}</span>
          ))}
        {!page.blocks.some((block) => block.visible) ? (
          <small>Adicione seu primeiro link.</small>
        ) : null}
      </div>
    </div>
  );
}

export function SmartPagesDashboard({
  initial,
  managedLinks,
}: {
  initial: { items: SmartPageSummary[]; page: number; hasMore: boolean };
  managedLinks: ManagedLink[];
}) {
  const [pages, setPages] = useState(initial.items);
  const [selected, setSelected] = useState<SmartPageDetail | null>(null);
  const [editorTab, setEditorTab] = useState<"editor" | "preview">("editor");
  const [metrics, setMetrics] = useState<SmartPageMetrics | null>(null);
  const action = useAction();

  async function selectPage(id: string) {
    await action.run(async () => {
      const page = await apiRequest<SmartPageDetail>(`/api/smart-pages/${id}`);
      setSelected(page);
      setMetrics(null);
      setEditorTab("editor");
    });
  }

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      form.reset();
    });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
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
          }),
        },
      );
      setSelected((current) => (current ? { ...current, ...page } : current));
      setPages((current) =>
        current.map((item) =>
          item.id === page.id ? { ...item, ...page } : item,
        ),
      );
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
    if (!selected) return;
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
      </div>

      <div className="smart-pages-grid">
        <aside className="smart-pages-sidebar" aria-label="Suas Smart Pages">
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
          <div className="smart-page-list">
            <h2>Suas páginas</h2>
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                className={
                  selected?.id === page.id
                    ? "smart-page-list-item active"
                    : "smart-page-list-item"
                }
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
              <p className="muted">Crie sua primeira página.</p>
            ) : null}
          </div>
        </aside>

        <div className="smart-page-workbench">
          <div
            className="smart-page-mobile-tabs"
            role="tablist"
            aria-label="Editor da Smart Page"
          >
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === "editor"}
              onClick={() => setEditorTab("editor")}
            >
              Editor
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === "preview"}
              onClick={() => setEditorTab("preview")}
            >
              Prévia
            </button>
          </div>
          {!selected ? (
            <div className="smart-page-editor-empty">
              <h2>Selecione ou crie uma Smart Page</h2>
              <p>O editor, a prévia e a publicação aparecem aqui.</p>
            </div>
          ) : (
            <>
              <div
                className={
                  editorTab === "preview"
                    ? "smart-page-editor mobile-hidden"
                    : "smart-page-editor"
                }
              >
                <div className="smart-page-editor-heading">
                  <div>
                    <h2>{selected.title}</h2>
                    <p>/{selected.slug}</p>
                  </div>
                  <div className="action-row">
                    <a
                      className="button button-secondary"
                      href={publicUrl(selected.slug)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir página
                    </a>
                    <button
                      className="button"
                      disabled={action.busy}
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
                >
                  <h3>Perfil</h3>
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
                    Slug
                    <input
                      required
                      name="slug"
                      minLength={3}
                      maxLength={60}
                      pattern="[a-z0-9-]+"
                      defaultValue={selected.slug}
                    />
                  </label>
                  <button
                    className="button button-secondary"
                    disabled={action.busy}
                  >
                    Salvar perfil
                  </button>
                </form>

                <section
                  className="smart-page-block-editor"
                  aria-labelledby="smart-page-content-heading"
                >
                  <h3 id="smart-page-content-heading">Conteúdo</h3>
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
                      <li key={block.id}>
                        <form onSubmit={(event) => saveBlock(event, block)}>
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
                              defaultValue={block.settings.destinationUrl ?? ""}
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
                <SmartPagePreview page={selected} />
              </div>
            </>
          )}
          <ActionStatus {...action} />
        </div>
      </div>
    </section>
  );
}
