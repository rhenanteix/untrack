"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { IconType } from "react-icons";
import {
  HiOutlineChartBarSquare,
  HiOutlineEye,
  HiOutlineLink,
  HiOutlinePaintBrush,
  HiOutlineShare,
  HiOutlineUserCircle,
} from "react-icons/hi2";
import {
  FaEnvelope,
  FaFacebookF,
  FaGlobe,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { BlockDestinationFields } from "@/components/smart-pages/block-destination-fields";
import { AppearanceControls } from "@/components/smart-pages/appearance-controls";
import { ImageUpload } from "@/components/smart-pages/image-upload";
import { SmartForm, SmartField } from "@/components/smart-pages/smart-form";
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
  | "website"
  | "email";

const socialNetworks: {
  value: SocialNetwork;
  label: string;
  placeholder: string;
  Icon: IconType;
}[] = [
  {
    value: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/seuperfil",
    Icon: FaInstagram,
  },
  {
    value: "tiktok",
    label: "TikTok",
    placeholder: "https://tiktok.com/@seuperfil",
    Icon: FaTiktok,
  },
  {
    value: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@seucanal",
    Icon: FaYoutube,
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/seuperfil",
    Icon: FaLinkedinIn,
  },
  {
    value: "x",
    label: "X",
    placeholder: "https://x.com/seuperfil",
    Icon: FaXTwitter,
  },
  {
    value: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/seuperfil",
    Icon: FaFacebookF,
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    placeholder: "https://wa.me/5511999999999",
    Icon: FaWhatsapp,
  },
  {
    value: "website",
    label: "Site",
    placeholder: "https://seusite.com",
    Icon: FaGlobe,
  },
  {
    value: "email",
    label: "E-mail",
    placeholder: "voce@exemplo.com",
    Icon: FaEnvelope,
  },
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

interface SmartPageDetail extends SmartPageSummary {
  blocks: SmartPageBlock[];
}

interface ManagedLink {
  domainKey: string;
  isActive: boolean;
  expiresAt: string | null;
  id: string;
  title: string;
  slug: string;
  destinationUrl: string;
}

interface ProductOption {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
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

function collectSocialLinks(
  data: FormData,
  order: { network: SocialNetwork; url: string }[],
) {
  const values = new Map(order.map((social) => [social.network, social.url]));
  for (const { value: network } of socialNetworks) {
    const field = `social-${network}`;
    if (!data.has(field)) continue;
    const url = String(data.get(field) ?? "").trim();
    if (url) values.set(network, url);
    else values.delete(network);
  }
  return [...values].map(([network, url]) => ({ network, url }));
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
          <span key={block.id}>
            {block.type === "product"
              ? block.product?.name ?? "Produto indisponível"
              : block.settings.title}
          </span>
        ))}
        {!visible.length && <p>Adicione seu primeiro link.</p>}
      </PageDesign>
    </div>
  );
}

export function SmartPagesDashboard({
  initial,
  managedLinks,
  products: initialProducts,
  canEdit = true,
  canUnpublish = canEdit,
  readOnlyReason = "Você tem acesso de leitura. Peça a um editor ou administrador para alterar páginas.",
  publicOrigin = "",
}: {
  initial: { items: SmartPageSummary[]; page: number; hasMore: boolean };
  managedLinks: ManagedLink[];
  products: ProductOption[];
  canEdit?: boolean;
  canUnpublish?: boolean;
  readOnlyReason?: string;
  publicOrigin?: string;
}) {
  const router = useRouter(),
    params = useSearchParams();
  const editId = params.get("edit");
  const [selectionLoading, setSelectionLoading] = useState(false),
    [selectionError, setSelectionError] = useState("");
  const [libraryLoading, setLibraryLoading] = useState(false),
    [libraryError, setLibraryError] = useState("");
  const [metricsDays, setMetricsDays] = useState(30),
    [metricsLoading, setMetricsLoading] = useState(false),
    [metricsError, setMetricsError] = useState(""),
    [metricsUpdated, setMetricsUpdated] = useState<string | null>(null),
    [metricsRevision, setMetricsRevision] = useState(0);
  const [pages, setPages] = useState(initial.items);
  const [products, setProducts] = useState(initialProducts);
  const [selected, setSelected] = useState<SmartPageDetail | null>(null);
  const [editorTab, setEditorTab] = useState<"editor" | "preview">("editor");
  const [metrics, setMetrics] = useState<SmartPageMetrics | null>(null);
  const action = useAction();
  const [blockDrafts, setBlockDrafts] = useState<
    Record<string, SmartPageBlock>
  >({});
  const [newBlockDraft, setNewBlockDraft] = useState<SmartPageBlock | null>(
    null,
  );
  const [activeForm, setActiveForm] = useState("");
  const [editorSection, setEditorSection] = useState("profile");
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [appliedSearch, setAppliedSearch] = useState(
    params.get("search") ?? "",
  );
  const [listPage, setListPage] = useState(initial.page);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [showCreate, setShowCreate] = useState(params.get("create") === "1");
  const [socialPickerOpen, setSocialPickerOpen] = useState(false);
  const [activeSocialNetwork, setActiveSocialNetwork] =
    useState<SocialNetwork | null>(null);
  const [profileDraft, setProfileDraft] = useState<Partial<SmartPageSummary>>(
    {},
  );
  const [dirty, setDirty] = useState(false);
  const [dirtyBlocks, setDirtyBlocks] = useState<string[]>([]);
  const editorRef = useRef<HTMLHeadingElement>(null);
  const hasUnsaved = dirty || dirtyBlocks.length > 0 || newBlockDraft !== null;
  const draftSocialLinks =
    profileDraft.socialLinks ?? selected?.socialLinks ?? [];
  const activeSocial = socialNetworks.find(
    (network) => network.value === activeSocialNetwork,
  );
  const activeSocialUrl = activeSocial
    ? (draftSocialLinks.find(
        (social) => social.network === activeSocial.value,
      )?.url ?? "")
    : "";
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);
  useEffect(() => {
    if (!editId) {
      // Clear the detail when browser navigation returns to the library.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(null);
      return;
    }
    const controller = new AbortController();
    setSelectionLoading(true);
    setSelectionError("");
    apiRequest<SmartPageDetail>(
      `/api/smart-pages/${encodeURIComponent(editId)}`,
      { signal: controller.signal },
    )
      .then((page) => {
        if (controller.signal.aborted) return;
        setSelected({
          ...page,
          theme: page.theme ?? { preset: "minimal" },
          socialLinks: page.socialLinks ?? [],
        });
        setProfileDraft({});
        setDirty(false);
        setDirtyBlocks([]);
        setBlockDrafts({});
        setNewBlockDraft(null);
        setEditorSection("profile");
        setEditorTab("editor");
        setSocialPickerOpen(false);
        setActiveSocialNetwork(null);
        setShowCreate(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setSelectionError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSelectionLoading(false);
      });
    return () => controller.abort();
  }, [editId]);
  useEffect(() => {
    if (editorSection !== "analytics" || !selected?.id) return;
    const controller = new AbortController();
    // A new period starts a separate, cancellable metrics request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMetricsLoading(true);
    setMetricsError("");
    setMetrics(null);
    apiRequest<SmartPageMetrics>(
      `/api/smart-pages/${selected.id}/analytics?days=${metricsDays}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setMetrics(data);
        setMetricsUpdated(new Date().toLocaleTimeString("pt-BR"));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMetricsError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setMetricsLoading(false);
      });
    return () => controller.abort();
  }, [selected?.id, editorSection, metricsDays, metricsRevision]);
  function openEditor(id: string) {
    const query = new URLSearchParams(params);
    query.set("edit", id);
    query.delete("create");
    router.push(`/untrack/smart-pages?${query}`, { scroll: false });
  }
  function backToLibrary() {
    if (
      hasUnsaved &&
      !window.confirm(
        "Descartar as alterações não salvas e voltar à biblioteca?",
      )
    )
      return;
    const query = new URLSearchParams(params);
    query.delete("edit");
    setSelected(null);
    setDirty(false);
    setDirtyBlocks([]);
    setNewBlockDraft(null);
    router.push(`/untrack/smart-pages?${query}`, { scroll: false });
  }
  async function loadPages(page: number, query = appliedSearch) {
    setLibraryLoading(true);
    setLibraryError("");
    try {
      const result = await apiRequest<typeof initial>(
        `/api/smart-pages?page=${page}&search=${encodeURIComponent(query)}`,
      );
      setPages(result.items);
      setListPage(result.page);
      setHasMore(result.hasMore);
      setAppliedSearch(query);
      const next = new URLSearchParams(params);
      next.set("page", String(page));
      next.set("search", query);
      router.replace(`/untrack/smart-pages?${next}`, { scroll: false });
    } catch (error) {
      setLibraryError(
        error instanceof Error ? error.message : "Falha ao carregar páginas.",
      );
    } finally {
      setLibraryLoading(false);
    }
  }
  function profileChanged(event: FormEvent<HTMLFormElement>) {
    if (
      !(
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) ||
      !event.target.name
    )
      return;
    const data = new FormData(event.currentTarget);
    action.setNotice("");
    setDirty(true);
    setProfileDraft({
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      avatarUrl: String(data.get("avatarUrl") ?? "") || null,
      theme: profileDraft.theme ?? selected?.theme ?? { preset: "minimal" },
      socialLinks: collectSocialLinks(
        data,
        profileDraft.socialLinks ?? selected?.socialLinks ?? [],
      ),
    });
  }

  function updateSocialLink(network: SocialNetwork, value: string) {
    const url =
      network === "email" && value
        ? `mailto:${value.replace(/^mailto:/i, "").trim()}`
        : value;
    setProfileDraft((current) => {
      const socialLinks = current.socialLinks ?? selected?.socialLinks ?? [];
      const next = socialLinks.filter((social) => social.network !== network);
      if (url) next.push({ network, url });
      return { ...current, socialLinks: next };
    });
    setDirty(true);
    action.setNotice("");
  }

  async function selectPage(id: string) {
    if (hasUnsaved && !window.confirm("Descartar alterações não salvas?"))
      return;
    openEditor(id);
  }
  async function createPage(event: FormEvent<HTMLFormElement>) {
    setActiveForm("create");
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
      // Render the editor only after its detail request finishes. This avoids
      // a late response resetting fields the user has already started editing.
      openEditor(page.id);
      setMetrics(null);
      setProfileDraft({});
      setEditorSection("profile");
      setDirty(false);
      setDirtyBlocks([]);
      setBlockDrafts({});
      setNewBlockDraft(null);
      setShowCreate(false);
      action.setNotice(
        "Rascunho criado. Adicione seus links e publique quando estiver pronto.",
      );
      form.reset();
    });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    setActiveForm("profile");
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const socialLinks = collectSocialLinks(
      data,
      profileDraft.socialLinks ?? selected.socialLinks,
    );
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
    setActiveForm("add");
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
      setNewBlockDraft(null);
      action.setNotice("Link adicionado.");
    });
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    setActiveForm("create-product");
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await action.run(async () => {
      const price = Number(data.get("price"));
      const product = await apiRequest<ProductOption>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          slug: data.get("slug"),
          type: data.get("type"),
          status: data.get("status"),
          priceInCents: Math.round(price * 100),
        }),
      });
      setProducts((current) => [product, ...current]);
      form.reset();
      action.setNotice("Produto criado. Adicione-o à sua página quando quiser.");
    });
  }

  async function addProductBlock(event: FormEvent<HTMLFormElement>) {
    setActiveForm("add-product");
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
            type: "product",
            productId: data.get("productId"),
            settings: { buttonLabel: data.get("buttonLabel") || "Ver produto" },
          }),
        },
      );
      setSelected((current) =>
        current ? { ...current, blocks: [...current.blocks, block] } : current,
      );
      form.reset();
      action.setNotice("Produto adicionado à página.");
    });
  }

  async function saveBlock(
    event: FormEvent<HTMLFormElement>,
    block: SmartPageBlock,
  ) {
    event.preventDefault();
    if (!selected) return;
    setActiveForm(block.id);
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
      setBlockDrafts((current) => {
        const next = { ...current };
        delete next[block.id];
        return next;
      });
      action.setNotice("Link atualizado.");
    });
  }

  async function saveProductBlock(
    event: FormEvent<HTMLFormElement>,
    block: SmartPageBlock,
  ) {
    event.preventDefault();
    if (!selected || !block.productId) return;
    setActiveForm(block.id);
    const data = new FormData(event.currentTarget);
    await action.run(async () => {
      const updated = await apiRequest<SmartPageBlock>(
        `/api/smart-pages/${selected.id}/blocks/${block.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            type: "product",
            productId: block.productId,
            visible: data.get("visible") === "on",
            analyticsEnabled: data.get("analyticsEnabled") === "on",
            settings: { buttonLabel: data.get("buttonLabel") },
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
      action.setNotice("Produto atualizado.");
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
    if (!selected || !(published ? canEdit : canUnpublish) || hasUnsaved)
      return;
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

  return (
    <section
      className={`smart-pages-dashboard sp-studio ${editId ? "is-editing" : "is-library"}`}
    >
      <div className="sp-studio-topbar">
        <div className="sp-studio-product">
          <Link href="/conta" className="sp-studio-brand" aria-label="Voltar para a conta">
            <span aria-hidden="true">↗</span>
            <strong>untrack</strong>
          </Link>
          <span className="sp-studio-divider" aria-hidden="true" />
          <strong>Smart Pages</strong>
        </div>
        {editId && (
          <button
            type="button"
            className="button button-secondary"
            onClick={backToLibrary}
          >
            Todas as páginas
          </button>
        )}
      </div>
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">SEU LINK EM BIO</span>
          <h1>{editId ? "Edite sua presença." : "Suas páginas, em um só lugar."}</h1>
          <p className="muted">
            Crie sua presença pública, organize seus links e acompanhe o que
            funciona.
          </p>
        </div>
        {canEdit && !editId && (
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
        {!canEdit && <p className="smart-page-readonly">{readOnlyReason}</p>}
      </div>
      <div className="smart-pages-grid">
        <aside
          hidden={!!editId}
          className="smart-pages-sidebar"
          aria-label="Suas Smart Pages"
        >
          {canEdit && showCreate && (
            <SmartForm
              className="smart-page-create"
              onSubmit={createPage}
              failure={activeForm === "create" ? action.failure : null}
            >
              <h2>Criar uma página</h2>
              <SmartField>
                Nome ou marca
                <input required name="title" maxLength={120} />
              </SmartField>
              <SmartField hint="Seu endereço público. Exemplo: ana-silva → /page/ana-silva. Não use espaços ou acentos.">
                Endereço da página
                <input
                  required
                  name="slug"
                  minLength={3}
                  maxLength={60}
                  placeholder="ana-silva"
                />
              </SmartField>
              <SmartField>
                Descrição curta
                <textarea name="description" maxLength={500} rows={3} />
              </SmartField>
              <button className="button" disabled={action.busy}>
                Criar página
              </button>
            </SmartForm>
          )}
          <div className="smart-page-list">
            <h2>Biblioteca de páginas</h2>
            <form
              className="smart-page-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                void loadPages(1, search);
              }}
            >
              <SmartField>
                Buscar por nome ou endereço
                <input
                  type="search"
                  value={search}
                  maxLength={120}
                  placeholder="Encontre uma página..."
                  onChange={(event) => setSearch(event.target.value)}
                />
              </SmartField>
              <button
                className="button button-secondary"
                disabled={action.busy}
              >
                Buscar
              </button>
            </form>
            {libraryLoading && <p role="status">Carregando páginas…</p>}
            {libraryError && (
              <div role="alert">
                <p>{libraryError}</p>
                <button
                  className="button button-secondary"
                  onClick={() => void loadPages(listPage)}
                >
                  Tentar novamente
                </button>
              </div>
            )}
            {!libraryError &&
              pages.map((page) => (
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
            {!libraryError && !libraryLoading && !pages.length ? (
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

        <div hidden={!editId} className="smart-page-workbench">
          {selectionLoading && <p role="status">Carregando editor…</p>}
          {selectionError && (
            <div role="alert">
              <p>{selectionError}</p>
              <button
                className="button button-secondary"
                onClick={() => window.location.reload()}
              >
                Tentar novamente
              </button>
            </div>
          )}
          <div
            className="smart-page-mobile-tabs"
            role="tablist"
            aria-label="Visualização do editor"
          >
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === "editor"}
              aria-controls="smart-page-editor-panel"
              onClick={() => setEditorTab("editor")}
            >
              Editar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === "preview"}
              aria-controls="smart-page-preview-panel"
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
                id="smart-page-editor-panel"
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
                      disabled={
                        action.busy ||
                        !(selected.status === "published"
                          ? canUnpublish
                          : canEdit) ||
                        hasUnsaved
                      }
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

                <nav
                  className="sp-editor-sections"
                  role="tablist"
                  aria-label="Etapas do editor"
                  onKeyDown={(event) => {
                    const tabs = Array.from(
                      event.currentTarget.querySelectorAll<HTMLButtonElement>(
                        '[role="tab"]',
                      ),
                    );
                    const index = tabs.indexOf(
                      document.activeElement as HTMLButtonElement,
                    );
                    const target =
                      event.key === "ArrowRight"
                        ? tabs[(index + 1) % tabs.length]
                        : event.key === "ArrowLeft"
                          ? tabs[(index - 1 + tabs.length) % tabs.length]
                          : event.key === "Home"
                            ? tabs[0]
                            : event.key === "End"
                              ? tabs.at(-1)
                              : null;
                    if (target) {
                      event.preventDefault();
                      target.click();
                      target.focus();
                    }
                  }}
                >
                  {[
                    {
                      id: "profile",
                      number: "01",
                      label: "Perfil",
                      Icon: HiOutlineUserCircle,
                    },
                    {
                      id: "appearance",
                      number: "02",
                      label: "Aparência",
                      Icon: HiOutlinePaintBrush,
                    },
                    {
                      id: "links",
                      number: "03",
                      label: "Links",
                      Icon: HiOutlineLink,
                    },
                    {
                      id: "analytics",
                      number: "04",
                      label: "Resultados",
                      Icon: HiOutlineChartBarSquare,
                    },
                  ].map(({ id, number, label, Icon }) => (
                    <button
                      type="button"
                      key={id}
                      role="tab"
                      id={`sp-tab-${id}`}
                      aria-selected={editorSection === id}
                      tabIndex={editorSection === id ? 0 : -1}
                      aria-controls={`sp-panel-${id}`}
                      onClick={() => setEditorSection(id)}
                    >
                      <Icon aria-hidden="true" />
                      <span aria-hidden="true">{number}</span>
                      {label}
                    </button>
                  ))}
                </nav>
                <SmartForm
                  hidden={!["profile", "appearance"].includes(editorSection)}
                  failure={activeForm === "profile" ? action.failure : null}
                  reveal={() => setEditorSection("profile")}
                  id="smart-page-profile-form"
                  className="smart-page-profile-form"
                  onSubmit={saveProfile}
                  onChange={profileChanged}
                >
                  <div className="sp-save-bar">
                    <small>
                      {action.busy
                        ? "Salvando…"
                        : action.error
                          ? "Falha ao salvar. Seus dados foram mantidos."
                          : hasUnsaved
                            ? "Alterações pendentes"
                            : "✓ Salvo"}
                    </small>
                    <button
                      className="button button-secondary"
                      disabled={action.busy || !canEdit}
                    >
                      Salvar perfil
                    </button>
                  </div>{" "}
                  <fieldset
                    className="smart-page-form-fields"
                    disabled={!canEdit || action.busy}
                  >
                    <legend>
                      {editorSection === "appearance"
                        ? "Escolha seu visual"
                        : "Sua apresentação"}
                    </legend>
                    <div
                      id="sp-panel-profile"
                      role="tabpanel"
                      aria-labelledby="sp-tab-profile"
                      className="sp-profile-fields"
                      hidden={editorSection !== "profile"}
                    >
                      <p className="sp-section-intro">
                        Apresente quem você é e como quer ser encontrado.
                        Depois, escolha um modelo e adicione seus links.
                      </p>
                      <SmartField>
                        Nome
                        <input
                          required
                          name="title"
                          maxLength={120}
                          defaultValue={selected.title}
                        />
                      </SmartField>
                      <SmartField hint="Para um currículo: cargo ou especialidade, resumo da experiência e o que você busca. Até 500 caracteres.">
                        Descrição
                        <textarea
                          name="description"
                          maxLength={500}
                          rows={3}
                          defaultValue={selected.description}
                        />
                      </SmartField>
                      <ImageUpload
                        currentUrl={
                          profileDraft.avatarUrl === undefined
                            ? selected.avatarUrl
                            : profileDraft.avatarUrl
                        }
                        pageId={selected.id}
                        disabled={!canEdit || action.busy}
                        onUploaded={(url) => {
                          setProfileDraft((current) => ({
                            ...current,
                            avatarUrl: url,
                          }));
                          setDirty(true);
                          action.setNotice("");
                        }}
                      />
                      <SmartField hint="Use o endereço https:// de uma imagem. Escolha uma foto nítida ou o logo da sua marca.">
                        Foto de perfil (URL)
                        <input
                          type="url"
                          name="avatarUrl"
                          value={
                            profileDraft.avatarUrl === undefined
                              ? (selected.avatarUrl ?? "")
                              : (profileDraft.avatarUrl ?? "")
                          }
                          onChange={(event) =>
                            setProfileDraft((current) => ({
                              ...current,
                              avatarUrl: event.target.value,
                            }))
                          }
                        />
                      </SmartField>
                      <SmartField hint="Use de 3 a 60 caracteres, sem espaços ou acentos. Exemplo: ana-silva. Alterar este endereço muda o link público.">
                        Endereço da página
                        <input
                          required
                          name="slug"
                          minLength={3}
                          maxLength={60}
                          placeholder="ana-silva"
                          defaultValue={selected.slug}
                        />
                      </SmartField>
                      <section
                        className="sp-social-composer"
                        aria-labelledby="smart-page-social-heading"
                      >
                        <div className="sp-social-heading">
                          <div>
                            <span>CONEXÕES</span>
                            <h3 id="smart-page-social-heading">
                              Redes e e-mail
                            </h3>
                          </div>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => setSocialPickerOpen((open) => !open)}
                            aria-expanded={socialPickerOpen}
                            aria-controls="smart-page-social-picker"
                          >
                            Adicionar
                          </button>
                        </div>
                        {socialPickerOpen && (
                          <div
                            id="smart-page-social-picker"
                            className="sp-social-picker"
                            role="group"
                            aria-label="Escolha uma rede ou e-mail"
                          >
                            <p>Onde as pessoas podem te encontrar?</p>
                            <div>
                              {socialNetworks.map(({ value, label, Icon }) => (
                                <button
                                  type="button"
                                  key={value}
                                  aria-label={`Adicionar ${label}`}
                                  onClick={() => {
                                    setActiveSocialNetwork(value);
                                    setSocialPickerOpen(false);
                                  }}
                                >
                                  <Icon aria-hidden="true" />
                                  <span>{label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {activeSocial && (
                          <div className="sp-social-input">
                            <span className="sp-social-input-icon" aria-hidden="true">
                              <activeSocial.Icon />
                            </span>
                            <SmartField>
                              {activeSocial.label}
                              <input
                                type={
                                  activeSocial.value === "email"
                                    ? "email"
                                    : "url"
                                }
                                name={`social-${activeSocial.value}`}
                                value={
                                  activeSocial.value === "email"
                                    ? activeSocialUrl.replace(/^mailto:/i, "")
                                    : activeSocialUrl
                                }
                                placeholder={activeSocial.placeholder}
                                onChange={(event) =>
                                  updateSocialLink(
                                    activeSocial.value,
                                    event.target.value,
                                  )
                                }
                              />
                            </SmartField>
                            <button
                              type="button"
                              className="button button-quiet"
                              onClick={() => {
                                updateSocialLink(activeSocial.value, "");
                                setActiveSocialNetwork(null);
                              }}
                            >
                              Remover
                            </button>
                          </div>
                        )}
                        {draftSocialLinks.length ? (
                          <ul className="sp-social-list">
                            {draftSocialLinks.map((social) => {
                              const network = socialNetworks.find(
                                (item) => item.value === social.network,
                              );
                              if (!network) return null;
                              const Icon = network.Icon;
                              return (
                                <li key={social.network}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveSocialNetwork(social.network)
                                    }
                                  >
                                    <Icon aria-hidden="true" />
                                    <span>{network.label}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="sp-social-empty">
                            Adicione suas redes e um e-mail para abrir caminhos de contato.
                          </p>
                        )}
                      </section>
                    </div>
                    <div
                      id="sp-panel-appearance"
                      role="tabpanel"
                      aria-labelledby="sp-tab-appearance"
                      hidden={editorSection !== "appearance"}
                    >
                      <ThemeGallery
                        value={profileDraft.theme ?? selected.theme}
                        disabled={!canEdit || action.busy}
                        onChange={(theme) => {
                          action.setNotice("");
                          setProfileDraft((current) => ({ ...current, theme }));
                          setDirty(true);
                        }}
                      />
                      <details className="sp-advanced">
                        <summary>Personalização avançada</summary>{" "}
                        <AppearanceControls
                          pageId={selected.id}
                          theme={profileDraft.theme ?? selected.theme}
                          disabled={!canEdit || action.busy}
                          onChange={(theme) => {
                            setProfileDraft((current) => ({
                              ...current,
                              theme,
                            }));
                            setDirty(true);
                            action.setNotice("");
                          }}
                        />
                      </details>{" "}
                    </div>
                  </fieldset>
                </SmartForm>

                <section
                  id="sp-panel-links"
                  role="tabpanel"
                  aria-labelledby="sp-tab-links"
                  hidden={editorSection !== "links"}
                  className="smart-page-block-editor"
                >
                  <h3 id="smart-page-content-heading">
                    Seus links, na ordem certa
                  </h3>
                  <p className="muted">
                    Adicione seu LinkedIn, currículo em PDF hospedado, projetos
                    ou contato. Use URLs completas (https://). Você pode
                    reordenar os links abaixo.
                  </p>
                  <fieldset
                    className="smart-page-form-fields"
                    disabled={!canEdit || action.busy}
                  >
                    <SmartForm
                      className="smart-page-add-block"
                      onSubmit={addBlock}
                      onChange={(event) => {
                        const data = new FormData(event.currentTarget);
                        const title = String(data.get("title") ?? "");
                        const destinationUrl = String(
                          data.get("destinationUrl") ?? "",
                        );
                        setNewBlockDraft(
                          title || destinationUrl
                            ? {
                                id: "preview-new",
                                type: "link",
                                position: selected.blocks.length,
                                visible: true,
                                analyticsEnabled: false,
                                linkId:
                                  String(data.get("linkId") || "") || null,
                                link:
                                  managedLinks.find(
                                    (link) => link.id === data.get("linkId"),
                                  ) ?? null,
                                settings: {
                                  title: title || "Novo link",
                                  destinationUrl,
                                  openInNewTab: true,
                                },
                              }
                            : null,
                        );
                      }}
                      failure={activeForm === "add" ? action.failure : null}
                    >
                      <SmartField>
                        Título
                        <input
                          required
                          name="title"
                          maxLength={120}
                          placeholder="Meu portfólio"
                        />
                      </SmartField>
                      <BlockDestinationFields links={managedLinks} />
                      <SmartField className="smart-page-check">
                        <input
                          type="checkbox"
                          name="openInNewTab"
                          defaultChecked
                        />{" "}
                        Abrir em nova aba
                      </SmartField>
                      <button className="button" disabled={action.busy}>
                        Adicionar link
                      </button>
                    </SmartForm>
                    <details className="sp-advanced">
                      <summary>Produtos</summary>
                      <SmartForm
                        onSubmit={createProduct}
                        failure={
                          activeForm === "create-product"
                            ? action.failure
                            : null
                        }
                      >
                        <SmartField>
                          Nome do produto
                          <input required name="name" maxLength={120} />
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
                            <option value="session">Sessão</option>
                            <option value="mentorship">Mentoria</option>
                            <option value="coaching">Coaching</option>
                            <option value="bundle">Bundle</option>
                            <option value="event">Evento</option>
                            <option value="subscription">Assinatura</option>
                          </select>
                        </SmartField>
                        <SmartField>
                          Preço (R$)
                          <input
                            required
                            name="price"
                            type="number"
                            min="0"
                            max="9999999.99"
                            step="0.01"
                          />
                        </SmartField>
                        <SmartField>
                          Status
                          <select name="status" defaultValue="draft">
                            <option value="draft">Rascunho</option>
                            <option value="active">Ativo</option>
                          </select>
                        </SmartField>
                        <button className="button button-secondary" disabled={action.busy}>
                          Criar produto
                        </button>
                      </SmartForm>
                      <SmartForm
                        onSubmit={addProductBlock}
                        failure={
                          activeForm === "add-product" ? action.failure : null
                        }
                      >
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
                          <input
                            name="buttonLabel"
                            maxLength={40}
                            defaultValue="Ver produto"
                          />
                        </SmartField>
                        <button
                          className="button button-secondary"
                          disabled={action.busy || !products.some((product) => product.status !== "archived")}
                        >
                          Adicionar produto
                        </button>
                      </SmartForm>
                    </details>
                    <ol className="smart-page-block-list">
                      {selected.blocks.map((block, index) =>
                        block.type === "product" ? (
                          <li key={`${block.id}:${block.productId}`}>
                            <details className="sp-link-card">
                              <summary>
                                <strong>
                                  {block.product?.name ??
                                    "Produto indisponível"}
                                </strong>
                                <span>
                                  {block.visible ? "Visível" : "Oculto"} · Produto{" "}
                                  {index + 1}
                                </span>
                              </summary>
                              {block.productId ? (
                                <SmartForm
                                  failure={
                                    activeForm === block.id
                                      ? action.failure
                                      : null
                                  }
                                  onSubmit={(event) =>
                                    saveProductBlock(event, block)
                                  }
                                >
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
                                  <div className="smart-page-block-options">
                                    <SmartField className="smart-page-check">
                                      <input
                                        type="checkbox"
                                        name="visible"
                                        defaultChecked={block.visible}
                                      />{" "}
                                      Visível
                                    </SmartField>
                                    <SmartField className="smart-page-check">
                                      <input
                                        type="checkbox"
                                        name="analyticsEnabled"
                                        defaultChecked={block.analyticsEnabled}
                                      />{" "}
                                      Medir cliques
                                    </SmartField>
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
                                      onClick={() =>
                                        void moveBlock(block.id, -1)
                                      }
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
                                      onClick={() =>
                                        void moveBlock(block.id, 1)
                                      }
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
                                </SmartForm>
                              ) : (
                                <p>O produto associado não está mais disponível.</p>
                              )}
                            </details>
                          </li>
                        ) : (
                        <li
                          key={`${block.id}:${block.settings.title}:${block.visible}:${block.linkId}`}
                        >
                          <details className="sp-link-card">
                            <summary>
                              <strong>
                                {blockDrafts[block.id]?.settings.title ??
                                  block.settings.title}
                              </strong>
                              <span>
                                {block.visible ? "Visível" : "Oculto"} · Link{" "}
                                {index + 1}
                              </span>
                            </summary>
                            <SmartForm
                              failure={
                                activeForm === block.id ? action.failure : null
                              }
                              onChange={(event) => {
                                const data = new FormData(event.currentTarget);
                                setBlockDrafts((current) => ({
                                  ...current,
                                  [block.id]: {
                                    ...block,
                                    linkId:
                                      String(data.get("linkId") || "") || null,
                                    link:
                                      managedLinks.find(
                                        (link) =>
                                          link.id === data.get("linkId"),
                                      ) ?? null,
                                    visible: data.get("visible") === "on",
                                    settings: {
                                      ...block.settings,
                                      title: String(data.get("title") ?? ""),
                                      destinationUrl: String(
                                        data.get("destinationUrl") ?? "",
                                      ),
                                    },
                                  },
                                }));
                                setDirtyBlocks((ids) =>
                                  ids.includes(block.id)
                                    ? ids
                                    : [...ids, block.id],
                                );
                              }}
                              onSubmit={(event) => saveBlock(event, block)}
                            >
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
                              <div className="smart-page-block-options">
                                <SmartField className="smart-page-check">
                                  <input
                                    type="checkbox"
                                    name="visible"
                                    defaultChecked={block.visible}
                                  />{" "}
                                  Visível
                                </SmartField>
                                <SmartField className="smart-page-check">
                                  <input
                                    type="checkbox"
                                    name="analyticsEnabled"
                                    defaultChecked={block.analyticsEnabled}
                                  />{" "}
                                  Medir cliques
                                </SmartField>
                                <SmartField className="smart-page-check">
                                  <input
                                    type="checkbox"
                                    name="openInNewTab"
                                    defaultChecked={block.settings.openInNewTab}
                                  />{" "}
                                  Nova aba
                                </SmartField>
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
                            </SmartForm>
                          </details>
                        </li>
                        ),
                      )}
                    </ol>
                  </fieldset>
                </section>
                <section
                  id="sp-panel-analytics"
                  role="tabpanel"
                  aria-labelledby="sp-tab-analytics"
                  hidden={editorSection !== "analytics"}
                  className="smart-page-metrics"
                >
                  <div className="smart-page-metrics-heading">
                    <div>
                      <h3 id="smart-page-analytics-heading">Resultados</h3>
                      <label>
                        Período
                        <select
                          value={metricsDays}
                          onChange={(e) =>
                            setMetricsDays(Number(e.target.value))
                          }
                        >
                          <option value={7}>Últimos 7 dias</option>
                          <option value={30}>Últimos 30 dias</option>
                          <option value={90}>Últimos 90 dias</option>
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={metricsLoading}
                      onClick={() => setMetricsRevision((v) => v + 1)}
                    >
                      Atualizar métricas
                    </button>
                  </div>
                  <p className="sp-field-hint">
                    {metricsUpdated
                      ? `Última atualização: ${metricsUpdated}. `
                      : ""}
                    CTR é a razão entre cliques e visualizações. Visitantes
                    únicos usam um identificador do navegador por sessão; não
                    representam pessoas identificadas. Amostras pequenas não
                    indicam tendência.
                  </p>
                  {metricsLoading ? (
                    <p role="status">Carregando resultados…</p>
                  ) : metricsError ? (
                    <div role="alert">
                      <p>{metricsError}</p>
                      <button onClick={() => setMetricsRevision((v) => v + 1)}>
                        Tentar novamente
                      </button>
                    </div>
                  ) : !metrics ? (
                    <p>Aguardando dados.</p>
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
                          <span>Cliques</span>
                        </div>
                        <div>
                          <strong>{metrics.ctr}%</strong>
                          <span>CTR</span>
                        </div>
                      </div>
                      <div className="smart-page-metric-lists">
                        <div>
                          <h4>Links com mais cliques</h4>
                          <ul>
                            {metrics.topLinks.map((link) => (
                              <li key={link.blockId}>
                                <span>{link.title}</span>
                                <strong>{link.clicks}</strong>
                              </li>
                            ))}
                            {!metrics.topLinks.length ? (
                              <li>Sem cliques ainda.</li>
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
                id="smart-page-preview-panel"
                className={
                  editorTab === "editor"
                    ? "smart-page-preview-panel mobile-hidden"
                    : "smart-page-preview-panel"
                }
              >
                  <div className="smart-page-preview-heading">
                    <div>
                      <span>PRÉVIA AO VIVO</span>
                      <h2>Seu link em ação</h2>
                    </div>
                    <div className="smart-page-preview-actions">
                      <a
                        href={publicUrl(selected.slug)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Abrir prévia em nova aba"
                        title="Abrir prévia em nova aba"
                      >
                        <HiOutlineEye aria-hidden="true" />
                      </a>
                      <CopyButton
                        value={`${publicOrigin}${publicUrl(selected.slug)}`}
                        label="Copiar endereço da página"
                      >
                        <HiOutlineShare aria-hidden="true" />
                      </CopyButton>
                    </div>
                  </div>
                  <p className="muted">
                    {dirty
                      ? "A prévia acompanha suas alterações. Salve para publicar."
                      : "Pronta para compartilhar com seu público."}
                  </p>
                  <div className="smart-page-device">
                    <div className="smart-page-device-bar" aria-hidden="true">
                      <i />
                      <span />
                      <b />
                    </div>
                    <SmartPagePreview
                      page={{
                        ...selected,
                        ...profileDraft,
                        blocks: [
                          ...selected.blocks.map(
                            (block) => blockDrafts[block.id] ?? block,
                          ),
                          ...(newBlockDraft ? [newBlockDraft] : []),
                        ],
                      }}
                    />
                  </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
