"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import type { IconType } from "react-icons";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowPath,
  HiOutlineBars3,
  HiOutlineChartBarSquare,
  HiOutlineComputerDesktop,
  HiOutlineDevicePhoneMobile,
  HiOutlineEllipsisHorizontal,
  HiOutlineEye,
  HiOutlineLink,
  HiOutlineMinus,
  HiOutlinePaintBrush,
  HiOutlinePlus,
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
import { AppearanceControls } from "@/components/smart-pages/appearance-controls";
import { AddContentModal } from "@/components/smart-pages/editor/add-content-modal";
import { ContentList } from "@/components/smart-pages/editor/content-list";
import type { SmartPageContentBlock } from "@/components/smart-pages/editor/content-block";
import { SmartPagePreview } from "@/components/smart-pages/editor/smart-page-preview";
import { ImageUpload } from "@/components/smart-pages/image-upload";
import {
  SmartForm,
  SmartField,
  SmartSelect,
} from "@/components/smart-pages/smart-form";
import { CopyButton } from "@/components/copy-button";
import { ActionStatus, apiRequest, useAction } from "./shared";

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

type SocialLink = {
  network: SocialNetwork;
  url: string;
  label?: string;
};

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
  socialLinks: SocialLink[];
  status: PageStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { blocks: number };
}

type SmartPageBlock = SmartPageContentBlock;

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
  order: SocialLink[],
) {
  const values = new Map(order.map((social) => [social.network, social]));
  for (const { value: network } of socialNetworks) {
    const field = `social-${network}`;
    if (!data.has(field)) continue;
    const url = String(data.get(field) ?? "").trim();
    if (url)
      values.set(network, {
        network,
        url,
        label: values.get(network)?.label,
      });
    else values.delete(network);
  }
  return [...values.values()];
}

function publicUrl(slug: string) {
  return `/page/${encodeURIComponent(slug)}`;
}

function brazilianCurrencyToNumber(value: FormDataEntryValue | null) {
  const source = String(value ?? "").trim();
  if (!source) return Number.NaN;
  const normalized = source.includes(",")
    ? source.replace(/\./g, "").replace(",", ".")
    : source;
  return Number(normalized);
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
  const [previewDevice, setPreviewDevice] = useState<"phone" | "desktop">(
    "phone",
  );
  const [previewZoom, setPreviewZoom] = useState(0.9);
  const [metrics, setMetrics] = useState<SmartPageMetrics | null>(null);
  const action = useAction();
  const [blockDrafts, setBlockDrafts] = useState<
    Record<string, SmartPageBlock>
  >({});
  const [activeForm, setActiveForm] = useState("");
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [editorSection, setEditorSection] = useState("profile");
  const [appearanceTab, setAppearanceTab] = useState<
    "themes" | "customize"
  >("themes");
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
  const [draggedSocialNetwork, setDraggedSocialNetwork] =
    useState<SocialNetwork | null>(null);
  const [profileDraft, setProfileDraft] = useState<Partial<SmartPageSummary>>(
    {},
  );
  const [dirty, setDirty] = useState(false);
  const [dirtyBlocks, setDirtyBlocks] = useState<string[]>([]);
  const [autosaveState, setAutosaveState] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const [autosaveError, setAutosaveError] = useState("");
  const [profileSaveError, setProfileSaveError] = useState<Error | null>(null);
  const [autosaveRevision, setAutosaveRevision] = useState(0);
  const editorRef = useRef<HTMLHeadingElement>(null);
  const profileDraftVersion = useRef(0);
  const failedProfileDraftVersion = useRef<number | null>(null);
  const autosavingProfile = useRef(false);
  const blockDraftVersions = useRef<Record<string, number>>({});
  const failedBlockDraftVersions = useRef<Record<string, number>>({});
  const autosavingBlockId = useRef<string | null>(null);
  const hasUnsaved = dirty || dirtyBlocks.length > 0;
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
  const activeSocialLabel = activeSocial
    ? (draftSocialLinks.find(
        (social) => social.network === activeSocial.value,
      )?.label ?? "")
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
    if (
      !selected ||
      !dirty ||
      autosavingProfile.current ||
      failedProfileDraftVersion.current === profileDraftVersion.current
    )
      return;
    const version = profileDraftVersion.current;
    const timeout = window.setTimeout(() => {
      autosavingProfile.current = true;
      setAutosaveState("saving");
      void apiRequest<SmartPageDetail>(`/api/smart-pages/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          slug: profileDraft.slug ?? selected.slug,
          title: profileDraft.title ?? selected.title,
          description: profileDraft.description ?? selected.description,
          avatarUrl:
            profileDraft.avatarUrl === undefined
              ? selected.avatarUrl
              : profileDraft.avatarUrl,
          theme: profileDraft.theme ?? selected.theme,
          socialLinks: profileDraft.socialLinks ?? selected.socialLinks,
        }),
      })
        .then((page) => {
          setSelected((current) =>
            current ? { ...current, ...page } : current,
          );
          setPages((current) =>
            current.map((item) =>
              item.id === page.id ? { ...item, ...page } : item,
            ),
          );
          if (profileDraftVersion.current !== version) return;
          setProfileDraft({});
          setDirty(false);
          failedProfileDraftVersion.current = null;
          setAutosaveError("");
          setProfileSaveError(null);
          setAutosaveState("saved");
        })
        .catch((error) => {
          if (profileDraftVersion.current !== version) return;
          failedProfileDraftVersion.current = version;
          const saveError =
            error instanceof Error
              ? error
              : new Error("Não foi possível salvar o perfil.");
          setProfileSaveError(saveError);
          setAutosaveError(
            saveError.message,
          );
          setAutosaveState("error");
        })
        .finally(() => {
          autosavingProfile.current = false;
          setAutosaveRevision((current) => current + 1);
        });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [autosaveRevision, dirty, profileDraft, selected]);
  useEffect(() => {
    const blockId = dirtyBlocks.find(
      (id) => blockDrafts[id]?.type === "link",
    );
    const draft = blockId ? blockDrafts[blockId] : null;
    if (
      !selected ||
      !blockId ||
      !draft ||
      autosavingBlockId.current ||
      failedBlockDraftVersions.current[blockId] ===
        blockDraftVersions.current[blockId]
    )
      return;
    const version = blockDraftVersions.current[blockId] ?? 0;
    const timeout = window.setTimeout(() => {
      autosavingBlockId.current = blockId;
      setAutosaveState("saving");
      void apiRequest<SmartPageBlock>(
        `/api/smart-pages/${selected.id}/blocks/${blockId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            type: "link",
            linkId: draft.linkId ?? null,
            visible: draft.visible,
            analyticsEnabled: draft.analyticsEnabled,
            settings: {
              title: draft.settings.title ?? "",
              destinationUrl: draft.settings.destinationUrl || undefined,
              openInNewTab: draft.settings.openInNewTab ?? true,
            },
          }),
        },
      )
        .then((updated) => {
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
          if (blockDraftVersions.current[blockId] !== version) return;
          setBlockDrafts((current) => {
            const next = { ...current };
            delete next[blockId];
            return next;
          });
          setDirtyBlocks((ids) => ids.filter((id) => id !== blockId));
          setAutosaveError("");
          setAutosaveState("saved");
        })
        .catch((error) => {
          if (blockDraftVersions.current[blockId] !== version) return;
          failedBlockDraftVersions.current[blockId] = version;
          setAutosaveError(
            error instanceof Error ? error.message : "Não foi possível salvar o conteúdo.",
          );
          setAutosaveState("error");
        })
        .finally(() => {
          autosavingBlockId.current = null;
          setAutosaveRevision((current) => current + 1);
        });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [autosaveRevision, blockDrafts, dirtyBlocks, selected]);
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
        profileDraftVersion.current = 0;
        failedProfileDraftVersion.current = null;
        autosavingProfile.current = false;
        setProfileSaveError(null);
        setDirtyBlocks([]);
        setBlockDrafts({});
        setEditorSection("profile");
        setAppearanceTab("themes");
        setEditorTab("editor");
        setContentModalOpen(false);
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
    setContentModalOpen(false);
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
  function markProfileDirty() {
    profileDraftVersion.current += 1;
    failedProfileDraftVersion.current = null;
    setDirty(true);
    setAutosaveError("");
    setProfileSaveError(null);
    action.setNotice("");
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
    if (event.target.name.startsWith("social-label-")) return;
    const data = new FormData(event.currentTarget);
    setProfileDraft({
      slug: String(data.get("slug") ?? ""),
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      avatarUrl: String(data.get("avatarUrl") ?? "") || null,
      theme: profileDraft.theme ?? selected?.theme ?? { preset: "minimal" },
      socialLinks: collectSocialLinks(
        data,
        profileDraft.socialLinks ?? selected?.socialLinks ?? [],
      ),
    });
    markProfileDirty();
  }

  function updateSocialLink(network: SocialNetwork, value: string) {
    const url =
      network === "email" && value
        ? `mailto:${value.replace(/^mailto:/i, "").trim()}`
        : value;
    setProfileDraft((current) => {
      const socialLinks = current.socialLinks ?? selected?.socialLinks ?? [];
      const next = socialLinks.filter((social) => social.network !== network);
      const existing = socialLinks.find(
        (social) => social.network === network,
      );
      if (url) next.push({ network, url, label: existing?.label });
      return { ...current, socialLinks: next };
    });
    markProfileDirty();
  }

  function updateSocialLabel(network: SocialNetwork, value: string) {
    const label = value.trim();
    setProfileDraft((current) => {
      const socialLinks = current.socialLinks ?? selected?.socialLinks ?? [];
      return {
        ...current,
        socialLinks: socialLinks.map((social) =>
          social.network === network
            ? { ...social, label: label || undefined }
            : social,
        ),
      };
    });
    markProfileDirty();
  }

  function reorderSocialLinks(target: SocialNetwork) {
    if (!draggedSocialNetwork || draggedSocialNetwork === target) return;
    setProfileDraft((current) => {
      const socialLinks = [
        ...(current.socialLinks ?? selected?.socialLinks ?? []),
      ];
      const from = socialLinks.findIndex(
        (social) => social.network === draggedSocialNetwork,
      );
      const to = socialLinks.findIndex((social) => social.network === target);
      if (from < 0 || to < 0) return current;
      const [moved] = socialLinks.splice(from, 1);
      socialLinks.splice(to, 0, moved);
      return { ...current, socialLinks };
    });
    setDraggedSocialNetwork(null);
    markProfileDirty();
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
      blockDraftVersions.current = {};
      failedBlockDraftVersions.current = {};
      setAutosaveError("");
      setAutosaveState("saved");
      setContentModalOpen(false);
      setShowCreate(false);
      action.setNotice(
        "Rascunho criado. Adicione seus links e publique quando estiver pronto.",
      );
      form.reset();
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
      setContentModalOpen(false);
      action.setNotice("Link adicionado.");
    });
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    setActiveForm("create-product");
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await action.run(async () => {
      const price = brazilianCurrencyToNumber(data.get("price"));
      if (!Number.isFinite(price) || price < 0)
        throw new Error("Informe um preço válido.");
      const product = await apiRequest<ProductOption>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          slug: data.get("slug"),
          description: data.get("description"),
          type: data.get("type"),
          status: data.get("status"),
          priceInCents: Math.round(price * 100),
        }),
      });
      if (selected) {
        const block = await apiRequest<SmartPageBlock>(
          `/api/smart-pages/${selected.id}/blocks`,
          {
            method: "POST",
            body: JSON.stringify({
              type: "product",
              productId: product.id,
              settings: { buttonLabel: "Ver produto" },
            }),
          },
        );
        setSelected((current) =>
          current
            ? { ...current, blocks: [...current.blocks, block] }
            : current,
        );
      }
      setProducts((current) => [product, ...current]);
      form.reset();
      setContentModalOpen(false);
      action.setNotice("Produto criado e adicionado à página.");
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
      setContentModalOpen(false);
      action.setNotice("Produto adicionado à página.");
    });
  }

  async function addSettingsBlock(
    type: Exclude<SmartPageBlock["type"], "link" | "product">,
    settings: Record<string, string>,
  ) {
    setActiveForm(`add-${type}`);
    if (!selected) return;
    await action.run(async () => {
      const block = await apiRequest<SmartPageBlock>(
        `/api/smart-pages/${selected.id}/blocks`,
        {
          method: "POST",
          body: JSON.stringify({ type, settings }),
        },
      );
      setSelected((current) =>
        current ? { ...current, blocks: [...current.blocks, block] } : current,
      );
      setContentModalOpen(false);
      action.setNotice("Conteúdo adicionado à página.");
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

  async function saveSettingsBlock(
    event: FormEvent<HTMLFormElement>,
    block: SmartPageBlock,
    settings: SmartPageBlock["settings"],
  ) {
    event.preventDefault();
    if (!selected) return;
    setActiveForm(block.id);
    await action.run(async () => {
      const updated = await apiRequest<SmartPageBlock>(
        `/api/smart-pages/${selected.id}/blocks/${block.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            type: block.type,
            visible: block.visible,
            analyticsEnabled: block.analyticsEnabled,
            settings,
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
      action.setNotice("Conteúdo atualizado.");
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
      setBlockDrafts((current) => {
        const next = { ...current };
        delete next[blockId];
        return next;
      });
      action.setNotice("Link excluído.");
    });
  }

  async function toggleBlock(block: SmartPageBlock) {
    if (!selected) return;
    if (block.type === "product" && !block.productId) return;
    const previous = selected.blocks;
    const visible = !block.visible;
    setSelected((current) =>
      current
        ? {
            ...current,
            blocks: current.blocks.map((item) =>
              item.id === block.id ? { ...item, visible } : item,
            ),
          }
        : current,
    );
    await action.run(async () => {
      try {
        const updated = await apiRequest<SmartPageBlock>(
          `/api/smart-pages/${selected.id}/blocks/${block.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(
              block.type === "product"
                ? {
                    type: "product",
                    productId: block.productId,
                    visible,
                    analyticsEnabled: block.analyticsEnabled,
                    settings: {
                      buttonLabel: block.settings.buttonLabel ?? "Ver produto",
                    },
                  }
                : {
                    type: "link",
                    linkId: block.linkId ?? null,
                    visible,
                    analyticsEnabled: block.analyticsEnabled,
                    settings: {
                      title: block.settings.title ?? "",
                      destinationUrl: block.settings.destinationUrl || undefined,
                      openInNewTab: block.settings.openInNewTab ?? true,
                    },
                  },
            ),
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
        setBlockDrafts((current) => {
          const draft = current[block.id];
          return draft
            ? { ...current, [block.id]: { ...draft, visible } }
            : current;
        });
        if (blockDraftVersions.current[block.id] !== undefined) {
          blockDraftVersions.current[block.id] += 1;
          delete failedBlockDraftVersions.current[block.id];
        }
      } catch (error) {
        setSelected((current) =>
          current ? { ...current, blocks: previous } : current,
        );
        throw error;
      }
    });
  }

  async function reorderBlocks(blockIds: string[]) {
    if (!selected || blockIds.length !== selected.blocks.length) return;
    const byId = new Map(selected.blocks.map((block) => [block.id, block]));
    const blocks = blockIds.map((id) => byId.get(id)).filter(
      (block): block is SmartPageBlock => Boolean(block),
    );
    if (blocks.length !== selected.blocks.length) return;
    const previous = selected.blocks;
    setSelected((current) => (current ? { ...current, blocks } : current));
    await action.run(async () => {
      try {
        await apiRequest(`/api/smart-pages/${selected.id}/blocks`, {
          method: "PATCH",
          body: JSON.stringify({ blockIds }),
        });
      } catch (error) {
        setSelected((current) =>
          current ? { ...current, blocks: previous } : current,
        );
        throw error;
      }
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
        {editId ? (
          <>
            <div className="sp-studio-navigation">
              <button
                type="button"
                className="sp-studio-back"
                onClick={backToLibrary}
              >
                <HiOutlineArrowLeft aria-hidden="true" />
                Smart Pages
              </button>
              {selected && (
                <div className="sp-studio-page-meta">
                  <strong>{selected.title}</strong>
                  <span>untrack.app/page/{selected.slug}</span>
                </div>
              )}
            </div>
            {selected && (
              <>
                <div className="sp-studio-status">
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
                  <span className="sp-studio-save-status" role="status">
                    {autosaveState === "saving"
                      ? "Salvando…"
                      : autosaveState === "error"
                        ? "Erro ao salvar"
                        : hasUnsaved
                          ? "Alterações pendentes"
                          : "✓ Salvo"}
                  </span>
                </div>
                <div className="sp-studio-toolbar-actions">
                  {selected.status === "published" && (
                    <a
                      className="button button-secondary"
                      href={publicUrl(selected.slug)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <HiOutlineEye aria-hidden="true" />
                      Visualizar
                    </a>
                  )}
                  {selected.status === "published" && (
                    <CopyButton
                      value={`${publicOrigin}${publicUrl(selected.slug)}`}
                      label="Compartilhar"
                    />
                  )}
                  {selected.status === "published" ? (
                    <div className="sp-studio-overflow">
                      <button
                        type="button"
                        className="button button-secondary sp-studio-overflow-trigger"
                        aria-label="Mais ações da página"
                        aria-expanded={toolbarMenuOpen}
                        aria-haspopup="menu"
                        disabled={action.busy}
                        onClick={() => setToolbarMenuOpen((open) => !open)}
                      >
                        <HiOutlineEllipsisHorizontal aria-hidden="true" />
                      </button>
                      {toolbarMenuOpen && (
                        <div className="sp-studio-overflow-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            className="sp-studio-danger-action"
                            disabled={action.busy || !canUnpublish || hasUnsaved}
                            onClick={() => {
                              setToolbarMenuOpen(false);
                              void setPublished(false);
                            }}
                          >
                            Despublicar página
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      className="button"
                      disabled={action.busy || !canEdit || hasUnsaved}
                      onClick={() => void setPublished(true)}
                    >
                      Publicar
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="sp-studio-product">
            <Link href="/conta" className="sp-studio-brand" aria-label="Voltar para a conta">
              <span aria-hidden="true">↗</span>
              <strong>untrack</strong>
            </Link>
            <span className="sp-studio-divider" aria-hidden="true" />
            <strong>Smart Pages</strong>
          </div>
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
                    <p className="sp-editor-url">untrack.app/page/{selected.slug}</p>
                    <p className="smart-page-save-status" role="status">
                      {action.busy
                        ? "Salvando…"
                        : autosaveState === "saving"
                          ? "Salvando…"
                        : action.error
                          ? "Erro ao salvar"
                          : autosaveState === "error"
                            ? "Erro ao salvar"
                          : hasUnsaved
                            ? "Alterações pendentes"
                            : "Salvo"}
                    </p>
                  </div>
                  <div className="action-row" hidden>
                    {selected.status === "published" && (
                      <a
                        className="button button-secondary"
                        href={publicUrl(selected.slug)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Visualizar
                      </a>
                    )}
                    {selected.status === "published" && (
                      <CopyButton
                        value={`${publicOrigin}${publicUrl(selected.slug)}`}
                        label="Compartilhar"
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
                      label: "Conteúdo",
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
                  failure={profileSaveError}
                  hideSummary
                  reveal={() => setEditorSection("profile")}
                  id="smart-page-profile-form"
                  className="smart-page-profile-form"
                  onSubmit={(event) => event.preventDefault()}
                  onChange={profileChanged}
                >
                  <div className="sp-save-bar">
                    <small>
                      {autosaveState === "saving"
                        ? "Salvando…"
                        : autosaveState === "error"
                          ? "Erro ao salvar"
                          : hasUnsaved
                            ? "Alterações pendentes"
                            : "✓ Salvo"}
                    </small>
                    {autosaveState === "error" && autosaveError && (
                      <span role="alert">{autosaveError}</span>
                    )}
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
                          markProfileDirty();
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
                            <div className="sp-social-fields">
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
                              <SmartField hint="Usado nos modos com texto.">
                                Texto exibido
                                <input
                                  name={`social-label-${activeSocial.value}`}
                                  maxLength={40}
                                  disabled={!activeSocialUrl}
                                  value={activeSocialLabel}
                                  placeholder={activeSocial.label}
                                  onChange={(event) =>
                                    updateSocialLabel(
                                      activeSocial.value,
                                      event.target.value,
                                    )
                                  }
                                />
                              </SmartField>
                            </div>
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
                                <li
                                  key={social.network}
                                  draggable={canEdit && !action.busy}
                                  className={
                                    draggedSocialNetwork === social.network
                                      ? "is-dragging"
                                      : undefined
                                  }
                                  onDragStart={() =>
                                    setDraggedSocialNetwork(social.network)
                                  }
                                  onDragEnd={() => setDraggedSocialNetwork(null)}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={() => reorderSocialLinks(social.network)}
                                >
                                  <span
                                    className="sp-social-drag-handle"
                                    aria-hidden="true"
                                  >
                                    <HiOutlineBars3 />
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveSocialNetwork(social.network)
                                    }
                                  >
                                    <Icon aria-hidden="true" />
                                    <span>{social.label || network.label}</span>
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
                      <section className="sp-theme-studio" aria-label="Theme Studio">
                        <div
                          className="sp-theme-studio-tabs"
                          role="tablist"
                          aria-label="Aparência"
                        >
                          <button
                            type="button"
                            role="tab"
                            aria-selected={appearanceTab === "themes"}
                            onClick={() => setAppearanceTab("themes")}
                          >
                            Temas
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={appearanceTab === "customize"}
                            onClick={() => setAppearanceTab("customize")}
                          >
                            Personalizar
                          </button>
                        </div>
                        {appearanceTab === "themes" ? (
                          <ThemeGallery
                            value={profileDraft.theme ?? selected.theme}
                            disabled={!canEdit || action.busy}
                            onChange={(theme) => {
                              setProfileDraft((current) => ({
                                ...current,
                                theme,
                              }));
                              markProfileDirty();
                            }}
                          />
                        ) : (
                          <AppearanceControls
                            pageId={selected.id}
                            theme={profileDraft.theme ?? selected.theme}
                            disabled={!canEdit || action.busy}
                            onChange={(theme) => {
                              setProfileDraft((current) => ({
                                ...current,
                                theme,
                              }));
                              markProfileDirty();
                            }}
                          />
                        )}
                      </section>
                    </div>
                  </fieldset>
                </SmartForm>

                <section
                  id="sp-panel-content"
                  role="tabpanel"
                  aria-labelledby="sp-tab-links"
                  hidden={editorSection !== "links"}
                  className="smart-page-block-editor sp-content-editor"
                >
                  <div className="sp-content-editor-heading">
                    <div>
                      <span>CONTEÚDO DA PÁGINA</span>
                      <h3 id="smart-page-content-heading">Monte sua página</h3>
                      <p className="muted">
                        Arraste para reorganizar. Selecione um card para editar apenas o que precisar.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button"
                      disabled={!canEdit || action.busy}
                      onClick={() => setContentModalOpen(true)}
                    >
                      + Adicionar
                    </button>
                  </div>
                  <ContentList
                    blocks={selected.blocks}
                    drafts={blockDrafts}
                    managedLinks={managedLinks}
                    busy={action.busy}
                    failure={activeForm ? action.failure : null}
                    canEdit={canEdit}
                    onDraftChange={(draft) => {
                      action.setNotice("");
                      blockDraftVersions.current[draft.id] =
                        (blockDraftVersions.current[draft.id] ?? 0) + 1;
                      delete failedBlockDraftVersions.current[draft.id];
                      setAutosaveError("");
                      setBlockDrafts((current) => ({
                        ...current,
                        [draft.id]: draft,
                      }));
                      setDirtyBlocks((ids) =>
                        ids.includes(draft.id) ? ids : [...ids, draft.id],
                      );
                    }}
                    onSaveProduct={(event, block) =>
                      void saveProductBlock(event, block)
                    }
                    onSaveBlock={(event, block, settings) =>
                      void saveSettingsBlock(event, block, settings)
                    }
                    onToggle={(block) => void toggleBlock(block)}
                    onDelete={(block) => void deleteBlock(block.id)}
                    onReorder={(blockIds) => void reorderBlocks(blockIds)}
                  />
                  {autosaveError && (
                    <p className="sp-content-autosave-error" role="alert">
                      {autosaveError}
                    </p>
                  )}
                </section>

                <AddContentModal
                  open={contentModalOpen}
                  links={managedLinks}
                  products={products}
                  busy={action.busy}
                  failure={
                    activeForm === "add" ||
                    activeForm === "add-product" ||
                    activeForm === "create-product"
                      ? action.error
                      : ""
                  }
                  onClose={() => setContentModalOpen(false)}
                  onAddLink={addBlock}
                  onAddProduct={addProductBlock}
                  onCreateProduct={createProduct}
                  onAddSettingsBlock={(type, settings) =>
                    void addSettingsBlock(type, settings)
                  }
                  onOpenSocials={(network) => {
                    setEditorSection("profile");
                    const match = socialNetworks.find(
                      (item) =>
                        item.label.toLocaleLowerCase("pt-BR") ===
                        network?.toLocaleLowerCase("pt-BR"),
                    );
                    if (match) setActiveSocialNetwork(match.value);
                    else setSocialPickerOpen(true);
                  }}
                />
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
                      <div className="sp-metrics-period">
                        Período
                        <SmartSelect
                          name="metricsPeriod"
                          value={String(metricsDays)}
                          onValueChange={(value) => setMetricsDays(Number(value))}
                          options={[
                            { value: "7", label: "Últimos 7 dias" },
                            { value: "30", label: "Últimos 30 dias" },
                            { value: "90", label: "Últimos 90 dias" },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="sp-metrics-refresh">
                      <span role="status">
                        {metricsUpdated
                          ? `Atualizado às ${metricsUpdated}`
                          : "Atualiza ao abrir"}
                      </span>
                      <button
                        type="button"
                        aria-label="Atualizar métricas"
                        title="Atualizar métricas"
                        disabled={metricsLoading}
                        onClick={() => setMetricsRevision((v) => v + 1)}
                      >
                        <HiOutlineArrowPath aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <details className="sp-metrics-methodology">
                    <summary>Como calculamos as métricas?</summary>
                    <p>
                      CTR é a razão entre cliques e visualizações. Visitantes
                      únicos usam um identificador do navegador por sessão; não
                      representam pessoas identificadas. Amostras pequenas não
                      indicam tendência.
                    </p>
                  </details>
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
                      <div className="sp-metric-cards">
                        {[
                          ["Visualizações", metrics.views],
                          ["Visitantes únicos", metrics.uniqueVisitors],
                          ["Cliques", metrics.clicks],
                          ["CTR", `${metrics.ctr}%`],
                        ].map(([label, value]) => (
                          <article key={label}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                          </article>
                        ))}
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
                  <div className="sp-preview-controls">
                    <div
                      className="sp-preview-device-toggle"
                      role="group"
                      aria-label="Dispositivo da prévia"
                    >
                      <button
                        type="button"
                        aria-pressed={previewDevice === "phone"}
                        aria-label="Visualizar em celular"
                        title="Celular"
                        onClick={() => setPreviewDevice("phone")}
                      >
                        <HiOutlineDevicePhoneMobile aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-pressed={previewDevice === "desktop"}
                        aria-label="Visualizar em desktop"
                        title="Desktop"
                        onClick={() => setPreviewDevice("desktop")}
                      >
                        <HiOutlineComputerDesktop aria-hidden="true" />
                      </button>
                    </div>
                    <div className="sp-preview-zoom" aria-label="Zoom da prévia">
                      <button
                        type="button"
                        aria-label="Diminuir zoom"
                        title="Diminuir zoom"
                        disabled={previewZoom <= 0.8}
                        onClick={() =>
                          setPreviewZoom((current) =>
                            Math.max(0.8, Number((current - 0.1).toFixed(1))),
                          )
                        }
                      >
                        <HiOutlineMinus aria-hidden="true" />
                      </button>
                      <span>{Math.round(previewZoom * 100)}%</span>
                      <button
                        type="button"
                        aria-label="Aumentar zoom"
                        title="Aumentar zoom"
                        disabled={previewZoom >= 1}
                        onClick={() =>
                          setPreviewZoom((current) =>
                            Math.min(1, Number((current + 0.1).toFixed(1))),
                          )
                        }
                      >
                        <HiOutlinePlus aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p className="muted">
                    {dirty
                      ? "A prévia acompanha suas alterações. Salve para publicar."
                      : "Pronta para compartilhar com seu público."}
                  </p>
                  <div
                    className="smart-page-device"
                    data-device={previewDevice}
                    style={
                      { "--sp-preview-zoom": previewZoom } as CSSProperties
                    }
                  >
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
