"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineXMark,
  HiOutlineEye,
  HiOutlineSparkles,
  HiOutlineLockClosed,
  HiOutlineDevicePhoneMobile,
  HiOutlineComputerDesktop,
  HiOutlineArrowLeft,
  HiOutlineCheck,
} from "react-icons/hi2";
import { SmartPagePreview } from "@/components/smart-pages/editor/smart-page-preview";
import { PageDesign } from "@/components/smart-pages/page-design";
import { analytics } from "@/lib/client/analytics";
import type { SmartPagePreviewData } from "./editor/smart-page-preview";
import styles from "./template-gallery.module.css";

const track = analytics.track;

export interface SmartPageTemplateSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  thumbnailUrl: string | null;
  plan: "free" | "premium";
  version: number;
  publishedAt: string | null;
}

export interface SmartPageTemplateDetail extends SmartPageTemplateSummary {
  theme: SmartPagePreviewData["theme"];
  blocks: Array<
    Omit<SmartPagePreviewData["blocks"][number], "id" | "position" | "link">
  >;
  socialLinks: SmartPagePreviewData["socialLinks"];
}

interface TemplateGalleryProps {
  onSelectTemplate: (template: SmartPageTemplateDetail) => void;
  onClose: () => void;
  userPlan: "free" | "premium";
  hasActiveTrial: boolean;
}

export function TemplateGallery({
  onSelectTemplate,
  onClose,
  userPlan,
  hasActiveTrial,
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<SmartPageTemplateSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedPlan, setSelectedPlan] = useState<"all" | "free" | "premium">(
    "all",
  );
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] =
    useState<SmartPageTemplateDetail | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "mobile",
  );

  const requestVersion = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewTrigger = useRef<string | null>(null);
  const viewed = useRef(false);
  useEffect(() => {
    if (!viewed.current) {
      viewed.current = true;
      track("template_gallery_viewed", { product: "smart-pages" });
    }
  }, []);
  useEffect(() => {
    if (previewTemplate) dialogRef.current?.showModal();
  }, [previewTemplate]);

  const canUsePremium = userPlan === "premium" || hasActiveTrial;

  const fetchTemplates = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(search && { search }),
        ...(selectedCategory !== "all" && { category: selectedCategory }),
        ...(selectedPlan !== "all" && { plan: selectedPlan }),
      });
      const response = await fetch(`/api/smart-pages/templates?${params}`);
      if (!response.ok) throw new Error("Falha ao carregar templates");
      const data = await response.json();
      if (version !== requestVersion.current) return;
      setTemplates((current) =>
        page === 1
          ? data.items
          : [
              ...current,
              ...data.items.filter(
                (item: SmartPageTemplateSummary) =>
                  !current.some((entry) => entry.id === item.id),
              ),
            ],
      );
      setHasMore(data.hasMore);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [page, search, selectedCategory, selectedPlan]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void fetchTemplates();
      },
      search ? 300 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      requestVersion.current++;
    };
  }, [fetchTemplates, search]);

  useEffect(() => {
    if (!search.trim()) return;
    const timer = window.setTimeout(
      () => track("template_searched", { product: "smart-pages" }),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/smart-pages/templates/categories", {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Falha ao carregar categorias");
        return response.json();
      })
      .then((data) => setCategories(data.categories))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPage(1);
    track("template_filtered", { category });
  };

  const handlePlanChange = (plan: "all" | "free" | "premium") => {
    setSelectedPlan(plan);
    setPage(1);
    track("template_filtered", { source: plan });
  };

  const handlePreview = async (templateId: string) => {
    previewTrigger.current = templateId;
    try {
      const response = await fetch(
        `/api/smart-pages/templates/${templateId}/preview`,
      );
      if (!response.ok) throw new Error("Falha ao carregar preview");
      const template = await response.json();
      track("template_previewed", {
        product: "smart-pages",
        source: template.slug,
      });
      setPreviewTemplate(template);
      setPreviewMode("mobile");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao carregar preview",
      );
    }
  };

  const handleClosePreview = () => {
    track("template_preview_closed", { product: "smart-pages" });
    setPreviewTemplate(null);
    requestAnimationFrame(() =>
      document.getElementById(`preview-${previewTrigger.current}`)?.focus(),
    );
  };

  const handleUseTemplate = (template: SmartPageTemplateDetail) => {
    if (template.plan === "premium" && !canUsePremium) {
      track("template_premium_blocked", {
        product: "smart-pages",
        source: template.slug,
      });
      return;
    }
    track("template_selected", {
      product: "smart-pages",
      source: template.slug,
    });
    onSelectTemplate(template);
  };

  const clearFilters = () => {
    track("template_filters_cleared", { product: "smart-pages" });
    setSearch("");
    setSelectedCategory("all");
    setSelectedPlan("all");
    setPage(1);
  };

  const hasActiveFilters =
    search || selectedCategory !== "all" || selectedPlan !== "all";

  if (previewTemplate) {
    return (
      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          handleClosePreview();
        }}
        className={styles.previewModal}
        aria-modal="true"
        aria-label={`Preview: ${previewTemplate.name}`}
      >
        <div className={styles.previewBackdrop} onClick={handleClosePreview} />
        <div className={styles.previewContainer}>
          <header className={styles.previewHeader}>
            <button
              className={styles.previewBack}
              onClick={handleClosePreview}
              aria-label="Fechar preview"
            >
              <HiOutlineArrowLeft aria-hidden="true" />
              Voltar
            </button>
            <div className={styles.previewTitle}>
              <strong>{previewTemplate.name}</strong>
              <span>{previewTemplate.category}</span>
            </div>
            <div className={styles.previewActions}>
              <div
                className={styles.previewModeToggle}
                role="group"
                aria-label="Modo de visualização"
              >
                <button
                  type="button"
                  className={`${styles.previewModeBtn} ${previewMode === "mobile" ? styles.active : ""}`}
                  onClick={() => {
                    setPreviewMode("mobile");
                    track("template_preview_device_changed", {
                      source: "mobile",
                    });
                  }}
                  aria-pressed={previewMode === "mobile"}
                  aria-label="Visualização mobile"
                >
                  <HiOutlineDevicePhoneMobile aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`${styles.previewModeBtn} ${previewMode === "desktop" ? styles.active : ""}`}
                  onClick={() => {
                    setPreviewMode("desktop");
                    track("template_preview_device_changed", {
                      source: "desktop",
                    });
                  }}
                  aria-pressed={previewMode === "desktop"}
                  aria-label="Visualização desktop"
                >
                  <HiOutlineComputerDesktop aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                className={styles.previewUseBtn}
                onClick={() => handleUseTemplate(previewTemplate)}
                aria-disabled={
                  previewTemplate.plan === "premium" && !canUsePremium
                }
              >
                {previewTemplate.plan === "premium" && !canUsePremium ? (
                  <>
                    <HiOutlineLockClosed aria-hidden="true" />
                    Premium
                  </>
                ) : (
                  <>
                    <HiOutlineCheck aria-hidden="true" />
                    Usar este template
                  </>
                )}
              </button>
            </div>
          </header>
          <div className={styles.previewContent} data-device={previewMode}>
            <SmartPagePreview
              page={{
                title: previewTemplate.name,
                description: previewTemplate.description,
                avatarUrl: null,
                theme: previewTemplate.theme,
                socialLinks: previewTemplate.socialLinks,
                blocks: previewTemplate.blocks.map((block, index) => ({
                  ...block,
                  id: `block-${index}`,
                  position: index,
                  link: null,
                  visible: block.visible,
                  analyticsEnabled: block.analyticsEnabled,
                })),
              }}
            />
          </div>
          {previewTemplate.plan === "premium" && !canUsePremium && (
            <div className={styles.premiumNotice}>
              <HiOutlineLockClosed aria-hidden="true" />
              <span>Este template é exclusivo para assinantes Premium.</span>
            </div>
          )}
        </div>
      </dialog>
    );
  }

  return (
    <section className={styles.gallery} aria-label="Galeria de templates">
      <header className={styles.galleryHeader}>
        <div className={styles.galleryTitle}>
          <h2>Crie sua próxima Smart Page</h2>
          <p>Escolha um modelo para começar ou crie sua página do zero</p>
        </div>
        <button
          type="button"
          className={styles.startFromScratch}
          onClick={() => {
            track("template_started_from_scratch", { product: "smart-pages" });
            onClose();
          }}
        >
          <HiOutlineSparkles aria-hidden="true" />
          Começar do zero
        </button>
      </header>

      <div className={styles.galleryToolbar}>
        <div className={styles.searchWrapper}>
          <HiOutlineMagnifyingGlass
            className={styles.searchIcon}
            aria-hidden="true"
          />
          <input
            type="search"
            className={styles.searchInput}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome, descrição..."
            aria-label="Buscar templates"
            maxLength={120}
          />
        </div>

        <div className={styles.filters} role="group" aria-label="Filtros">
          <div className={styles.filterGroup}>
            <label htmlFor="category-filter" className={styles.filterLabel}>
              <HiOutlineFunnel aria-hidden="true" />
              Categoria
            </label>
            <select
              id="category-filter"
              className={styles.filterSelect}
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="all">Todas</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="plan-filter" className={styles.filterLabel}>
              Plano
            </label>
            <select
              id="plan-filter"
              className={styles.filterSelect}
              value={selectedPlan}
              onChange={(e) =>
                handlePlanChange(e.target.value as "all" | "free" | "premium")
              }
            >
              <option value="all">Todos</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className={styles.clearFilters}
              onClick={clearFilters}
            >
              <HiOutlineXMark aria-hidden="true" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className={styles.loading} role="status">
          Carregando templates…
        </div>
      )}

      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={fetchTemplates}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && (
        <div
          className={styles.grid}
          role="list"
          aria-label="Templates disponíveis"
        >
          {templates.length === 0 ? (
            <div className={styles.empty} role="listitem">
              <HiOutlineMagnifyingGlass
                className={styles.emptyIcon}
                aria-hidden="true"
              />
              <strong>Nenhum template encontrado</strong>
              <p>
                {hasActiveFilters
                  ? "Tente ajustar seus filtros ou busca."
                  : "Nenhum template publicado no momento."}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className={styles.clearFilters}
                  onClick={clearFilters}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className={styles.card} role="listitem">
                <div className={styles.thumbnailWrapper}>
                  {template.thumbnailUrl ? (
                    <img
                      src={template.thumbnailUrl}
                      alt=""
                      className={styles.thumbnail}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className={styles.thumbnailPlaceholder}
                      aria-hidden="true"
                    >
                      <PageDesign
                        title={template.name}
                        description={template.description}
                        theme={{ preset: "minimal" }}
                        preview
                      >
                        <span>Link 1</span>
                        <span>Link 2</span>
                        <span>Link 3</span>
                      </PageDesign>
                    </div>
                  )}
                  <div className={styles.thumbnailOverlay}>
                    <button
                      type="button"
                      id={`preview-${template.id}`}
                      className={styles.previewBtn}
                      onClick={() => handlePreview(template.id)}
                      aria-label={`Visualizar ${template.name}`}
                    >
                      <HiOutlineEye aria-hidden="true" />
                      Visualizar
                    </button>
                  </div>
                  {template.plan === "premium" && (
                    <span className={`${styles.badge} ${styles.badgePremium}`}>
                      <HiOutlineSparkles aria-hidden="true" />
                      Premium
                    </span>
                  )}
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.cardMeta}>
                    <span className={styles.category}>{template.category}</span>
                    {template.plan === "premium" && !canUsePremium && (
                      <span
                        className={`${styles.badge} ${styles.badgeLocked}`}
                        title="Requer plano Premium"
                      >
                        <HiOutlineLockClosed aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <h3 className={styles.cardTitle}>{template.name}</h3>
                  <p className={styles.cardDescription}>
                    {template.description}
                  </p>
                  <button
                    type="button"
                    className={`${styles.useBtn} ${template.plan === "premium" && !canUsePremium ? styles.disabled : ""}`}
                    onClick={() => {
                      if (template.plan === "premium" && !canUsePremium) {
                        track("template_premium_blocked", {
                          product: "smart-pages",
                          source: template.slug,
                        });
                        return;
                      }
                      // Fetch full template detail
                      fetch(`/api/smart-pages/templates/${template.id}`)
                        .then((res) => {
                          if (!res.ok)
                            throw new Error("Falha ao carregar template");
                          return res.json();
                        })
                        .then((detail) => handleUseTemplate(detail))
                        .catch((err: Error) => setError(err.message));
                    }}
                    aria-disabled={
                      template.plan === "premium" && !canUsePremium
                    }
                  >
                    {template.plan === "premium" && !canUsePremium ? (
                      <>
                        <HiOutlineLockClosed aria-hidden="true" />
                        Exclusivo Premium
                      </>
                    ) : (
                      "Usar template"
                    )}
                  </button>
                </div>
              </div>
            ))
          )}

          {hasMore && (
            <div role="listitem" className={styles.loadMore}>
              <button
                type="button"
                onClick={() => {
                  track("template_load_more", { product: "smart-pages" });
                  setPage((p) => p + 1);
                }}
                disabled={loading}
              >
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
