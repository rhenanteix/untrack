"use client";

import { useEffect, useEffectEvent, useState, type FormEvent } from "react";
import type { IconType } from "react-icons";
import {
  HiOutlineArrowLeft,
  HiOutlineChevronRight,
  HiOutlineDocumentText,
  HiOutlineLink,
  HiOutlineMagnifyingGlass,
  HiOutlinePlay,
  HiOutlineShoppingBag,
  HiOutlineUserGroup,
  HiOutlineXMark,
} from "react-icons/hi2";
import { BlockDestinationFields } from "@/components/smart-pages/block-destination-fields";
import {
  CurrencyInput,
  SmartField,
  SmartSelect,
} from "@/components/smart-pages/smart-form";

type ContentKind =
  "choose" | "link" | "product" | "create-product" | "social" | "settings";
type SettingsBlockType =
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
  | "appointment"
  | "form";
type ContentCategory =
  | "suggested"
  | "links"
  | "social"
  | "monetization"
  | "media"
  | "contact"
  | "products"
  | "text"
  | "other";

const categories: { id: ContentCategory; label: string }[] = [
  { id: "suggested", label: "Sugeridos" },
  { id: "links", label: "Links" },
  { id: "social", label: "Social" },
  { id: "monetization", label: "Monetização" },
  { id: "media", label: "Mídia" },
  { id: "contact", label: "Contato" },
  { id: "products", label: "Produtos" },
  { id: "text", label: "Texto" },
  { id: "other", label: "Outros" },
];

type ContentOption = {
  id: string;
  title: string;
  description: string;
  categories: ContentCategory[];
  Icon: IconType;
  action?: ContentKind;
  blockType?: SettingsBlockType;
};

const contentOptions: ContentOption[] = [
  {
    id: "link",
    title: "Link",
    description: "Qualquer endereço da web",
    categories: ["suggested", "links"],
    Icon: HiOutlineLink,
    action: "link",
  },
  {
    id: "social",
    title: "Redes sociais",
    description: "Instagram, TikTok, LinkedIn e mais",
    categories: ["suggested", "social", "contact"],
    Icon: HiOutlineUserGroup,
    action: "social",
  },
  {
    id: "product",
    title: "Produto",
    description: "Venda ou destaque o que você oferece",
    categories: ["suggested", "monetization", "products"],
    Icon: HiOutlineShoppingBag,
    action: "product",
  },
  {
    id: "video",
    title: "Vídeo",
    description: "Incorpore um vídeo do YouTube",
    categories: ["media"],
    Icon: HiOutlinePlay,
    action: "settings",
    blockType: "video",
  },
  {
    id: "image",
    title: "Imagem",
    description: "Mostre uma imagem com contexto",
    categories: ["media"],
    Icon: HiOutlineDocumentText,
    action: "settings",
    blockType: "image",
  },
  {
    id: "spotify",
    title: "Spotify",
    description: "Faixa, álbum ou playlist",
    categories: ["media"],
    Icon: HiOutlinePlay,
    action: "settings",
    blockType: "spotify",
  },
  {
    id: "title",
    title: "Título",
    description: "Destaque uma nova seção",
    categories: ["text"],
    Icon: HiOutlineDocumentText,
    action: "settings",
    blockType: "title",
  },
  {
    id: "text",
    title: "Texto",
    description: "Adicione uma mensagem à página",
    categories: ["text"],
    Icon: HiOutlineDocumentText,
    action: "settings",
    blockType: "text",
  },
  {
    id: "divider",
    title: "Separador",
    description: "Crie uma pausa visual",
    categories: ["text"],
    Icon: HiOutlineDocumentText,
    action: "settings",
    blockType: "divider",
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    description: "Receba mensagens diretamente",
    categories: ["suggested", "contact"],
    Icon: HiOutlineUserGroup,
    action: "settings",
    blockType: "whatsapp",
  },
  {
    id: "email",
    title: "E-mail",
    description: "Abra uma nova mensagem",
    categories: ["contact"],
    Icon: HiOutlineDocumentText,
    action: "settings",
    blockType: "email",
  },
  {
    id: "phone",
    title: "Telefone",
    description: "Permita ligações com um toque",
    categories: ["contact"],
    Icon: HiOutlineUserGroup,
    action: "settings",
    blockType: "phone",
  },
  {
    id: "form",
    title: "Formulário",
    description: "Capture contatos diretamente na sua página",
    categories: ["suggested", "contact"],
    Icon: HiOutlineDocumentText,
    action: "settings",
    blockType: "form",
  },
  {
    id: "file",
    title: "Arquivo",
    description: "Compartilhe um PDF ou documento",
    categories: ["other"],
    Icon: HiOutlineDocumentText,
    action: "settings",
    blockType: "file",
  },
  {
    id: "qr",
    title: "QR Code",
    description: "Gere um QR para qualquer destino",
    categories: ["other"],
    Icon: HiOutlineDocumentText,
    action: "settings",
    blockType: "qr",
  },
  {
    id: "event",
    title: "Evento",
    description: "Divulgue uma data importante",
    categories: ["other"],
    Icon: HiOutlineDocumentText,
    action: "settings",
    blockType: "event",
  },
  {
    id: "appointment",
    title: "Agendamento",
    description: "Envie para sua agenda",
    categories: ["contact", "other"],
    Icon: HiOutlineDocumentText,
    action: "settings",
    blockType: "appointment",
  },
];

const socialOptions = [
  "Instagram",
  "TikTok",
  "LinkedIn",
  "YouTube",
  "X",
  "Facebook",
  "WhatsApp",
] as const;

const defaultFormSettings = {
  name: "Novo formulário",
  title: "Fale comigo",
  description: "Deixe seus dados e entraremos em contato.",
  submitLabel: "Enviar",
  successMessage: "Obrigado! Recebemos seus dados.",
  privacyPolicyUrl: null,
  status: "active",
  fields: [
    {
      fieldType: "name",
      label: "Nome",
      placeholder: "Seu nome",
      required: true,
      options: [],
    },
    {
      fieldType: "email",
      label: "E-mail",
      placeholder: "voce@exemplo.com",
      required: true,
      options: [],
    },
    {
      fieldType: "phone",
      label: "WhatsApp / telefone",
      placeholder: "+55 11 99999-9999",
      required: false,
      options: [],
    },
  ],
} as const;

function detectedPlatform(value: string) {
  const url = value.trim();
  if (!url) return null;
  let hostname = "";
  try {
    hostname = new URL(url.includes("://") ? url : `https://${url}`).hostname;
  } catch {
    return null;
  }
  if (hostname.includes("instagram.com")) return "Instagram";
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
    return "YouTube";
  if (hostname.includes("tiktok.com")) return "TikTok";
  if (hostname.includes("linkedin.com")) return "LinkedIn";
  return null;
}

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
  onOpenSocials,
  onAddSettingsBlock,
}: {
  open: boolean;
  links: { id: string; title: string | null; slug: string }[];
  products: {
    id: string;
    name: string;
    status: "draft" | "active" | "archived";
  }[];
  busy: boolean;
  failure: string;
  onClose: () => void;
  onAddLink: (event: FormEvent<HTMLFormElement>) => void;
  onAddProduct: (event: FormEvent<HTMLFormElement>) => void;
  onCreateProduct: (event: FormEvent<HTMLFormElement>) => void;
  onOpenSocials: (network?: string) => void;
  onAddSettingsBlock: (
    type: SettingsBlockType,
    settings: Record<string, unknown>,
  ) => void;
}) {
  const [kind, setKind] = useState<ContentKind>("choose");
  const [category, setCategory] = useState<ContentCategory>("suggested");
  const [search, setSearch] = useState("");
  const [productType, setProductType] = useState("digital");
  const [settingsType, setSettingsType] = useState<SettingsBlockType | null>(
    null,
  );
  const [pastedUrl, setPastedUrl] = useState("");
  const platform = detectedPlatform(search);
  const visibleOptions = contentOptions.filter((option) => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (query && !platform)
      return `${option.title} ${option.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(query);
    return option.categories.includes(category);
  });

  function closeModal() {
    setKind("choose");
    setCategory("suggested");
    setSearch("");
    setProductType("digital");
    setSettingsType(null);
    setPastedUrl("");
    onClose();
  }

  function selectSettingsBlock(type: SettingsBlockType, url = "") {
    setSettingsType(type);
    setPastedUrl(url);
    setKind("settings");
  }

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settingsType) return;
    const data = new FormData(event.currentTarget);
    onAddSettingsBlock(
      settingsType,
      Object.fromEntries(
        Array.from(data.entries(), ([key, value]) => [
          key,
          String(value).trim(),
        ]),
      ),
    );
  }

  function settingsTitle() {
    return (
      contentOptions.find((option) => option.blockType === settingsType)
        ?.title ?? "Conteúdo"
    );
  }

  const closeOnEscape = useEffectEvent(() => {
    if (!busy) closeModal();
  });

  useEffect(() => {
    if (!open) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeOnEscape();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [open]);

  if (!open) return null;

  return (
    <div className="sp-add-content-layer" role="presentation">
      <button
        type="button"
        className="sp-add-content-backdrop"
        aria-label="Fechar adicionar conteúdo"
        disabled={busy}
        onClick={closeModal}
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
            onClick={closeModal}
          >
            <HiOutlineXMark aria-hidden="true" />
          </button>
        </header>
        {failure && (
          <p className="sp-add-content-error" role="alert">
            {failure}
          </p>
        )}
        {kind === "choose" ? (
          <div className="sp-content-picker">
            <label className="sp-content-search">
              <HiOutlineMagnifyingGlass aria-hidden="true" />
              <input
                type="search"
                value={search}
                autoFocus
                placeholder="Cole um link ou pesquise..."
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            {platform && (
              <div className="sp-content-detected">
                <div>
                  <strong>{platform} detectado</strong>
                  <span>{search}</span>
                </div>
                {platform === "YouTube" ? (
                  <button
                    type="button"
                    onClick={() => selectSettingsBlock("video", search)}
                  >
                    Incorporar vídeo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSocials(platform);
                      closeModal();
                    }}
                  >
                    Adicionar {platform}
                  </button>
                )}
              </div>
            )}
            <div className="sp-content-picker-layout">
              <nav aria-label="Categorias de conteúdo">
                {categories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={category === item.id ? "page" : undefined}
                    onClick={() => {
                      setCategory(item.id);
                      setSearch("");
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
              <section aria-live="polite">
                <p>{categories.find((item) => item.id === category)?.label}</p>
                <div
                  className="sp-add-content-choices"
                  aria-label="Tipo de conteúdo"
                >
                  {visibleOptions.map(
                    ({ id, title, description, Icon, action, blockType }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          if (blockType === "form") {
                            onAddSettingsBlock(
                              "form",
                              structuredClone(defaultFormSettings),
                            );
                            closeModal();
                          } else if (blockType) selectSettingsBlock(blockType);
                          else if (action) setKind(action);
                        }}
                      >
                        <Icon aria-hidden="true" />
                        <span>
                          <strong>{title}</strong>
                          <small>{description}</small>
                        </span>
                        <HiOutlineChevronRight aria-hidden="true" />
                      </button>
                    ),
                  )}
                  {!visibleOptions.length && (
                    <p className="sp-add-content-empty">
                      Nenhum tipo de conteúdo encontrado.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="sp-add-content-back"
            onClick={() =>
              setKind(kind === "create-product" ? "product" : "choose")
            }
          >
            <HiOutlineArrowLeft aria-hidden="true" />
            {kind === "create-product"
              ? "Adicionar produto"
              : "Adicionar conteúdo"}
          </button>
        )}
        {kind === "link" ? (
          <form className="sp-add-content-form" noValidate onSubmit={onAddLink}>
            <SmartField>
              Título
              <input
                required
                name="title"
                maxLength={120}
                placeholder="Meu portfólio"
                autoComplete="off"
                autoFocus
              />
            </SmartField>
            <BlockDestinationFields
              key={platform === "YouTube" ? search : "link"}
              links={links}
              initialUrl={platform === "YouTube" ? search : ""}
            />
            <SmartField className="smart-page-check">
              <input type="checkbox" name="openInNewTab" defaultChecked /> Abrir
              em nova aba
            </SmartField>
            <button className="button" disabled={busy}>
              Adicionar link
            </button>
          </form>
        ) : kind === "product" ? (
          <form
            className="sp-add-content-form"
            noValidate
            onSubmit={onAddProduct}
          >
            <div className="sp-add-content-product-heading">
              <div>
                <strong>Adicionar produto</strong>
                <small>Escolha um produto da sua loja ou crie um novo.</small>
              </div>
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => setKind("create-product")}
              >
                + Criar novo produto
              </button>
            </div>
            {products.some((product) => product.status !== "archived") ? (
              <>
                <SmartField>
                  Produto
                  <SmartSelect
                    required
                    name="productId"
                    placeholder="Selecione um produto"
                    options={products
                      .filter((product) => product.status !== "archived")
                      .map((product) => ({
                        value: product.id,
                        label: product.name,
                        description:
                          product.status === "draft" ? "Rascunho" : "Ativo",
                      }))}
                  />
                </SmartField>
                <SmartField>
                  Texto do botão
                  <input
                    name="buttonLabel"
                    maxLength={40}
                    defaultValue="Ver produto"
                  />
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
        ) : kind === "social" ? (
          <div className="sp-social-content-picker">
            <p>Escolha uma rede para configurar no seu perfil.</p>
            <div>
              {socialOptions.map((network) => (
                <button
                  key={network}
                  type="button"
                  onClick={() => {
                    onOpenSocials(network);
                    closeModal();
                  }}
                >
                  <span>{network}</span>
                  <HiOutlineChevronRight aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ) : kind === "settings" && settingsType ? (
          <form
            className="sp-add-content-form"
            noValidate
            onSubmit={submitSettings}
          >
            <div className="sp-add-content-product-heading">
              <div>
                <strong>
                  Adicionar {settingsTitle().toLocaleLowerCase("pt-BR")}
                </strong>
                <small>Essa alteração aparecerá imediatamente na prévia.</small>
              </div>
            </div>
            {settingsType === "title" && (
              <>
                <SmartField>
                  Título
                  <input
                    required
                    name="text"
                    maxLength={120}
                    autoFocus
                    placeholder="Ex: Próximos eventos"
                  />
                </SmartField>
                <SmartField>
                  Tamanho
                  <SmartSelect
                    name="level"
                    defaultValue="h2"
                    options={[
                      { value: "h2", label: "Destaque" },
                      { value: "h3", label: "Subtítulo" },
                    ]}
                  />
                </SmartField>
              </>
            )}
            {settingsType === "text" && (
              <SmartField>
                Texto
                <textarea
                  required
                  name="content"
                  maxLength={1000}
                  rows={5}
                  autoFocus
                  placeholder="Escreva uma mensagem para quem visita sua página."
                />
              </SmartField>
            )}
            {settingsType === "divider" && (
              <SmartField>
                Estilo
                <SmartSelect
                  name="style"
                  defaultValue="solid"
                  options={[
                    { value: "solid", label: "Linha contínua" },
                    { value: "dashed", label: "Tracejada" },
                    { value: "dotted", label: "Pontilhada" },
                  ]}
                />
              </SmartField>
            )}
            {settingsType === "image" && (
              <>
                <SmartField>
                  Imagem (URL)
                  <input
                    required
                    type="url"
                    name="imageUrl"
                    autoFocus
                    placeholder="https://exemplo.com/imagem.webp"
                  />
                </SmartField>
                <SmartField hint="Descreva a imagem para acessibilidade.">
                  Texto alternativo
                  <input
                    name="alt"
                    maxLength={160}
                    placeholder="Foto de uma palestra"
                  />
                </SmartField>
                <SmartField hint="Opcional: abre quando alguém seleciona a imagem.">
                  Destino da imagem
                  <input
                    type="url"
                    name="destinationUrl"
                    placeholder="https://exemplo.com"
                  />
                </SmartField>
              </>
            )}
            {(settingsType === "video" || settingsType === "spotify") && (
              <>
                <SmartField
                  hint={
                    settingsType === "video"
                      ? "Use um endereço do YouTube."
                      : "Use um link de faixa, álbum ou playlist do Spotify."
                  }
                >
                  {settingsType === "video" ? "Vídeo" : "Spotify"}
                  <input
                    required
                    type="url"
                    name="url"
                    autoFocus
                    defaultValue={pastedUrl}
                    placeholder={
                      settingsType === "video"
                        ? "https://youtube.com/watch?v=..."
                        : "https://open.spotify.com/..."
                    }
                  />
                </SmartField>
                <SmartField>
                  Título
                  <input
                    name="title"
                    maxLength={120}
                    placeholder={
                      settingsType === "video"
                        ? "Meu último vídeo"
                        : "Minha playlist"
                    }
                  />
                </SmartField>
              </>
            )}
            {settingsType === "file" && (
              <>
                <SmartField>
                  Nome do arquivo
                  <input
                    required
                    name="title"
                    maxLength={120}
                    autoFocus
                    placeholder="Meu portfólio"
                  />
                </SmartField>
                <SmartField>
                  Arquivo (URL)
                  <input
                    required
                    type="url"
                    name="url"
                    placeholder="https://exemplo.com/arquivo.pdf"
                  />
                </SmartField>
              </>
            )}
            {settingsType === "qr" && (
              <>
                <SmartField>
                  Título
                  <input
                    name="title"
                    maxLength={120}
                    autoFocus
                    placeholder="Escaneie o QR code"
                  />
                </SmartField>
                <SmartField>
                  Destino do QR Code
                  <input
                    required
                    type="url"
                    name="destinationUrl"
                    placeholder="https://exemplo.com"
                  />
                </SmartField>
              </>
            )}
            {(settingsType === "whatsapp" || settingsType === "phone") && (
              <>
                <SmartField>
                  {settingsType === "whatsapp"
                    ? "Número do WhatsApp"
                    : "Telefone"}
                  <input
                    required
                    name="number"
                    inputMode="tel"
                    autoFocus
                    placeholder="+55 11 99999-9999"
                  />
                </SmartField>
                <SmartField>
                  Texto do botão
                  <input
                    required
                    name="label"
                    maxLength={80}
                    defaultValue={
                      settingsType === "whatsapp"
                        ? "Falar no WhatsApp"
                        : "Ligar"
                    }
                  />
                </SmartField>
                {settingsType === "whatsapp" && (
                  <SmartField hint="Opcional: aparece ao abrir a conversa.">
                    Mensagem inicial
                    <textarea name="message" maxLength={500} rows={3} />
                  </SmartField>
                )}
              </>
            )}
            {settingsType === "email" && (
              <>
                <SmartField>
                  E-mail
                  <input
                    required
                    type="email"
                    name="address"
                    autoFocus
                    placeholder="voce@exemplo.com"
                  />
                </SmartField>
                <SmartField>
                  Assunto inicial
                  <input name="subject" maxLength={160} />
                </SmartField>
                <SmartField>
                  Texto do botão
                  <input
                    required
                    name="label"
                    maxLength={80}
                    defaultValue="Enviar e-mail"
                  />
                </SmartField>
              </>
            )}
            {(settingsType === "event" || settingsType === "appointment") && (
              <>
                <SmartField>
                  {settingsType === "event"
                    ? "Nome do evento"
                    : "Texto do botão"}
                  <input
                    required
                    name="title"
                    maxLength={120}
                    autoFocus
                    defaultValue={
                      settingsType === "appointment" ? "Agendar um horário" : ""
                    }
                  />
                </SmartField>
                {settingsType === "event" && (
                  <SmartField hint="Opcional: use data, horário ou período.">
                    Quando acontece
                    <input
                      name="date"
                      maxLength={80}
                      placeholder="12 de outubro, 19h"
                    />
                  </SmartField>
                )}
                <SmartField>
                  Destino
                  <input
                    required
                    type="url"
                    name="destinationUrl"
                    placeholder="https://cal.com/seunome"
                  />
                </SmartField>
              </>
            )}
            <button className="button" disabled={busy}>
              Adicionar {settingsTitle().toLocaleLowerCase("pt-BR")}
            </button>
          </form>
        ) : (
          <form
            className="sp-add-content-form"
            noValidate
            onSubmit={onCreateProduct}
          >
            <div className="sp-add-content-product-heading">
              <div>
                <strong>Criar produto</strong>
                <small>
                  Comece pelo essencial. Você poderá complementar depois.
                </small>
              </div>
            </div>
            <SmartField>
              Nome do produto
              <input
                required
                name="name"
                maxLength={120}
                autoComplete="off"
                autoFocus
              />
            </SmartField>
            <SmartField hint="Explique em poucas linhas o que a pessoa recebe.">
              Descrição
              <textarea name="description" maxLength={5000} rows={3} />
            </SmartField>
            <SmartField>
              Status
              <SmartSelect
                name="type"
                defaultValue="digital"
                onValueChange={setProductType}
                options={[
                  {
                    value: "digital",
                    label: "Digital",
                    description: "Arquivo ou acesso online",
                  },
                  {
                    value: "physical",
                    label: "Físico",
                    description: "Item enviado ao cliente",
                  },
                  {
                    value: "session",
                    label: "Serviço",
                    description: "Atendimento ou consultoria",
                  },
                  {
                    value: "booking",
                    label: "Agendamento",
                    description: "Sessão com horário",
                  },
                ]}
              />
            </SmartField>
            <p className="sp-product-type-note">
              {productType === "digital"
                ? "Use a página do produto para orientar a entrega digital."
                : productType === "physical"
                  ? "Use a página do produto para explicar o envio e a retirada."
                  : "Use a página do produto para compartilhar os próximos passos com a pessoa interessada."}
            </p>
            <SmartField>
              Preço
              <CurrencyInput required name="price" />
            </SmartField>
            <SmartField>
              Endereço do produto
              <input
                required
                name="slug"
                minLength={3}
                maxLength={140}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                autoComplete="off"
              />
            </SmartField>
            <SmartField>
              Tipo
              <SmartSelect
                name="status"
                defaultValue="draft"
                options={[
                  {
                    value: "draft",
                    label: "Rascunho",
                    description: "Apenas você vê",
                  },
                  {
                    value: "active",
                    label: "Ativo",
                    description: "Pronto para a página",
                  },
                ]}
              />
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
