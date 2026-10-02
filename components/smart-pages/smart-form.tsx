"use client";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { ApiRequestError } from "@/lib/client/api";
import { smartPageSlugSchema } from "@/modules/smart-pages/schemas";
const Errors = createContext<Record<string, string>>({});
export function fieldMessages(
  error: Error | null,
  form: HTMLFormElement,
): Record<string, string> {
  if (!(error instanceof ApiRequestError)) return {};
  if (error.code === "SLUG_EXISTS")
    return {
      slug: "Este endereço já pertence a outra página. Acrescente seu sobrenome ou área de atuação, por exemplo: ana-silva-design.",
    };
  const socials = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name^="social-"]'),
  ).filter((input) => input.value.trim());
  return Object.fromEntries(
    error.fields.map(({ field, message }) => {
      const match = field.match(/^socialLinks\.(\d+)\.url$/);
      return [
        match
          ? (socials[Number(match[1])]?.name ?? field)
          : field.replace(/^settings\./, ""),
        message,
      ];
    }),
  );
}
export function SmartField({
  children,
  hint,
  ...props
}: {
  children: ReactNode;
  hint?: string;
} & React.LabelHTMLAttributes<HTMLLabelElement>) {
  const errors = useContext(Errors);
  const id = useId();
  const input = Children.toArray(children).find(
    (child) =>
      isValidElement(child) &&
      ["input", "select", "textarea"].includes(String(child.type)),
  ) as ReactElement<{ name?: string; "aria-describedby"?: string }> | undefined;
  const error = input?.props.name ? errors[input.props.name] : undefined;
  return (
    <div className="sp-field">
      <label {...props}>
        {Children.map(children, (child) =>
          isValidElement(child) &&
          input &&
          (child.props as { name?: string }).name === input.props.name
            ? cloneElement(input, {
                "aria-describedby": [
                  input.props["aria-describedby"],
                  hint ? `${id}-hint` : "",
                  error ? `${id}-error` : "",
                ]
                  .filter(Boolean)
                  .join(" "),
                ...{ "aria-invalid": !!error },
              })
            : child,
        )}
      </label>
      {hint && (
        <small id={`${id}-hint`} className="sp-field-hint">
          {hint}
        </small>
      )}
      {error && (
        <span id={`${id}-error`} className="sp-field-error">
          {error}
        </span>
      )}
    </div>
  );
}
export function SmartForm({
  failure = null,
  reveal,
  hideSummary = false,
  children,
  onSubmit,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & {
  failure?: Error | null;
  reveal?: () => void;
  hideSummary?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const revealRef = useRef(reveal);
  useEffect(() => {
    revealRef.current = reveal;
  });
  function focusFirst(fields: Record<string, string>) {
    const name = Object.keys(fields)[0];
    if (!name) return;
    revealRef.current?.();
    // Revealing a tab and releasing a disabled fieldset can commit after this
    // effect. Wait for the field to be visible and enabled before focusing it.
    let attempts = 0;
    const focusWhenReady = () => {
      const input = ref.current?.elements.namedItem(name);
      if (!(input instanceof HTMLElement)) return;
      for (
        let details = input.closest("details");
        details;
        details = details.parentElement?.closest("details") ?? null
      )
        details.open = true;
      if (
        (!input.getClientRects().length || input.matches(":disabled")) &&
        attempts++ < 12
      ) {
        requestAnimationFrame(focusWhenReady);
        return;
      }
      input.focus({ preventScroll: true });
      input.scrollIntoView({ block: "center", behavior: "instant" });
    };
    requestAnimationFrame(focusWhenReady);
  }
  useEffect(() => {
    if (!ref.current) return;
    const next = fieldMessages(failure, ref.current);
    setErrors(next);
    focusFirst(next);
  }, [failure]);
  return (
    <Errors.Provider value={errors}>
      <form
        {...props}
        ref={ref}
        noValidate
        onSubmit={(event) => {
          const next: Record<string, string> = {};
          for (const input of Array.from(event.currentTarget.elements)) {
            if (
              !(
                input instanceof HTMLInputElement ||
                input instanceof HTMLTextAreaElement ||
                input instanceof HTMLSelectElement
              ) ||
              input.disabled ||
              !input.name
            )
              continue;
            if (input.name === "slug") {
              const result = smartPageSlugSchema.safeParse(input.value);
              if (!result.success) next.slug = result.error.issues[0].message;
            } else if (!input.validity.valid)
              next[input.name] = input.validity.valueMissing
                ? "Preencha este campo para continuar."
                : input.validity.typeMismatch
                  ? "Informe uma URL completa, como https://exemplo.com/perfil."
                  : "Confira o formato e o tamanho deste valor.";
          }
          setErrors(next);
          if (Object.keys(next).length) {
            event.preventDefault();
            focusFirst(next);
            return;
          }
          onSubmit?.(event);
        }}
      >
        {!hideSummary && Object.keys(errors).length > 0 && (
          <div className="sp-form-summary" role="alert">
            <strong>Vamos ajustar alguns campos</strong>
            <span>
              Seus dados foram mantidos. Veja os campos destacados abaixo.
            </span>
          </div>
        )}
        {!hideSummary && failure && !Object.keys(errors).length && (
          <div className="sp-form-summary" role="alert">
            <strong>Não foi possível salvar</strong>
            <span>{failure.message} Seus dados continuam no formulário.</span>
          </div>
        )}
        {children}
      </form>
    </Errors.Provider>
  );
}
