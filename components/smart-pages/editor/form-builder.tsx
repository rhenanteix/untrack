"use client";

import { useState } from "react";
import {
  HiOutlineArrowDown,
  HiOutlineArrowUp,
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import type { PublicSmartPageFormData } from "@/components/smart-pages/public-form";
import { SmartField } from "@/components/smart-pages/smart-form";

type Field = PublicSmartPageFormData["fields"][number] & { options: string[] };
type FieldInput = Omit<Field, "id"> & { id?: string };

export type SmartPageFormSettings = {
  name: string;
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  privacyPolicyUrl: string | null;
  status: "active" | "inactive";
  fields: FieldInput[];
};

type Draft = Omit<SmartPageFormSettings, "fields"> & { fields: Field[] };

const fieldTypes = [
  ["name", "Nome"],
  ["email", "E-mail"],
  ["phone", "WhatsApp / telefone"],
  ["company", "Empresa"],
  ["job_title", "Cargo"],
  ["message", "Mensagem"],
  ["consent", "Consentimento"],
  ["text", "Texto curto"],
  ["textarea", "Texto longo"],
  ["select", "Seleção"],
  ["checkbox", "Checkbox"],
] as const;

function fieldsFrom(form: PublicSmartPageFormData): Field[] {
  return form.fields.map((field) => ({
    ...field,
    options: Array.isArray(field.options)
      ? field.options.filter(
          (option): option is string => typeof option === "string",
        )
      : [],
  }));
}

function formFrom(form: PublicSmartPageFormData): Draft {
  return {
    name: form.name,
    title: form.title,
    description: form.description,
    submitLabel: form.submitLabel,
    successMessage: form.successMessage,
    privacyPolicyUrl: form.privacyPolicyUrl,
    status: form.status,
    fields: fieldsFrom(form),
  };
}

export function FormBuilder({
  form,
  busy,
  canEdit,
  onSave,
}: {
  form: PublicSmartPageFormData;
  busy: boolean;
  canEdit: boolean;
  onSave: (settings: SmartPageFormSettings) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => formFrom(form));

  function updateField(index: number, update: Partial<Field>) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...update } : field,
      ),
    }));
  }

  function moveField(index: number, offset: -1 | 1) {
    setDraft((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.fields.length) return current;
      const fields = [...current.fields];
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...current, fields };
    });
  }

  return (
    <form
      className="sp-form-builder"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...draft,
          fields: draft.fields.map(({ id, ...field }) =>
            id.startsWith("new-") ? field : { id, ...field },
          ),
        });
      }}
    >
      <fieldset disabled={busy || !canEdit}>
        <div className="sp-form-builder-grid">
          <SmartField>
            Nome interno
            <input
              required
              maxLength={120}
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </SmartField>
          <SmartField className="smart-page-check">
            <input
              type="checkbox"
              checked={draft.status === "active"}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  status: event.target.checked ? "active" : "inactive",
                }))
              }
            />{" "}
            Aceitar respostas
          </SmartField>
        </div>
        <SmartField>
          Título
          <input
            required
            maxLength={120}
            value={draft.title}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
          />
        </SmartField>
        <SmartField>
          Descrição
          <textarea
            maxLength={500}
            rows={3}
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </SmartField>
        <div className="sp-form-builder-grid">
          <SmartField>
            Texto do botão
            <input
              required
              maxLength={80}
              value={draft.submitLabel}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  submitLabel: event.target.value,
                }))
              }
            />
          </SmartField>
          <SmartField>
            Política de Privacidade
            <input
              type="url"
              maxLength={4096}
              placeholder="https://exemplo.com/privacidade"
              value={draft.privacyPolicyUrl ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  privacyPolicyUrl: event.target.value || null,
                }))
              }
            />
          </SmartField>
        </div>
        <SmartField>
          Mensagem de sucesso
          <textarea
            required
            maxLength={500}
            rows={3}
            value={draft.successMessage}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                successMessage: event.target.value,
              }))
            }
          />
        </SmartField>

        <div className="sp-form-builder-fields-heading">
          <div>
            <strong>Campos</strong>
            <small>Inclua e-mail ou telefone para identificar o contato.</small>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                fields: [
                  ...current.fields,
                  {
                    id: `new-${crypto.randomUUID()}`,
                    fieldType: "text",
                    label: "Novo campo",
                    placeholder: null,
                    required: false,
                    options: [],
                  },
                ],
              }))
            }
          >
            <HiOutlinePlus aria-hidden="true" /> Adicionar campo
          </button>
        </div>
        <div className="sp-form-builder-fields">
          {draft.fields.map((field, index) => (
            <fieldset key={field.id} className="sp-form-builder-field">
              <div className="sp-form-builder-field-actions">
                <button
                  type="button"
                  aria-label={`Mover ${field.label} acima`}
                  title="Mover acima"
                  disabled={index === 0}
                  onClick={() => moveField(index, -1)}
                >
                  <HiOutlineArrowUp aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Mover ${field.label} abaixo`}
                  title="Mover abaixo"
                  disabled={index === draft.fields.length - 1}
                  onClick={() => moveField(index, 1)}
                >
                  <HiOutlineArrowDown aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${field.label}`}
                  title="Remover campo"
                  disabled={draft.fields.length === 1}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      fields: current.fields.filter(
                        (_, fieldIndex) => fieldIndex !== index,
                      ),
                    }))
                  }
                >
                  <HiOutlineTrash aria-hidden="true" />
                </button>
              </div>
              <div className="sp-form-builder-grid">
                <SmartField>
                  Tipo
                  <select
                    value={field.fieldType}
                    onChange={(event) =>
                      updateField(index, {
                        fieldType: event.target.value,
                        options:
                          event.target.value === "select" ? field.options : [],
                      })
                    }
                  >
                    {fieldTypes.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </SmartField>
                <SmartField className="smart-page-check">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) =>
                      updateField(index, { required: event.target.checked })
                    }
                  />{" "}
                  Obrigatório
                </SmartField>
              </div>
              <SmartField>
                Rótulo
                <input
                  required
                  maxLength={120}
                  value={field.label}
                  onChange={(event) =>
                    updateField(index, { label: event.target.value })
                  }
                />
              </SmartField>
              {!["consent", "checkbox", "select"].includes(field.fieldType) && (
                <SmartField>
                  Placeholder
                  <input
                    maxLength={160}
                    value={field.placeholder ?? ""}
                    onChange={(event) =>
                      updateField(index, {
                        placeholder: event.target.value || null,
                      })
                    }
                  />
                </SmartField>
              )}
              {field.fieldType === "select" && (
                <SmartField hint="Uma opção por linha.">
                  Opções
                  <textarea
                    required
                    rows={3}
                    value={field.options.join("\n")}
                    onChange={(event) =>
                      updateField(index, {
                        options: event.target.value
                          .split("\n")
                          .map((option) => option.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </SmartField>
              )}
            </fieldset>
          ))}
        </div>
      </fieldset>
      <button className="button button-secondary" disabled={busy || !canEdit}>
        Salvar formulário
      </button>
    </form>
  );
}
