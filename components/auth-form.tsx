"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/client/auth";

export function AuthForm({
  mode,
  returnTo,
}: {
  mode: "login" | "register";
  returnTo: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const register = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const credentials = {
        email: String(form.get("email")).trim().toLowerCase(),
        password: String(form.get("password")),
      };
      const result = register
        ? await authClient.signUp.email({
            ...credentials,
            name: String(form.get("name")).trim(),
          })
        : await authClient.signIn.email(credentials);
      if (result.error) {
        const code = result.error.code;
        throw new Error(
          code === "USER_ALREADY_EXISTS" ||
            code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "Este e-mail já está cadastrado. Entre na sua conta."
            : result.error.status === 429
              ? "Muitas tentativas. Aguarde um minuto e tente novamente."
              : register
                ? "Não foi possível criar a conta. Confira os dados e use uma senha com pelo menos 12 caracteres."
                : "E-mail ou senha incorretos.",
        );
      }
      router.replace(returnTo);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha de conexão. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card tool-card">
      <form onSubmit={submit} className="account-form">
        {register && (
          <label>
            <span>Seu nome</span>
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
            />
          </label>
        )}
        <label>
          <span>E-mail</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          <span>Senha</span>
          <input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 12 : 1}
            maxLength={128}
          />
        </label>
        {register && (
          <p className="privacy-note">
            Use pelo menos 12 caracteres. Com a conta, seus resultados e links
            serão salvos para acesso em outros dispositivos.
          </p>
        )}
        <button className="button" disabled={busy} type="submit">
          {busy ? "Aguarde..." : register ? "Criar minha conta" : "Entrar"}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
      <p className="auth-switch">
        {register ? "Já tem uma conta? " : "Ainda não tem conta? "}
        <Link
          href={`${register ? "/entrar" : "/cadastro"}?next=${encodeURIComponent(returnTo)}`}
        >
          {register ? "Entrar" : "Criar conta"}
        </Link>
      </p>
    </div>
  );
}
