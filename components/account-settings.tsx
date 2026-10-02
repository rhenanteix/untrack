"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { apiRequest } from "@/lib/client/api";

type AccountSettingsProps = {
  profile: { name: string; email: string; image: string | null };
  workspace: {
    name: string;
    slug: string | null;
    logoUrl: string | null;
    timezone: string;
    locale: string;
    notifications: boolean;
    plan: "free" | "premium";
  };
  canManage: boolean;
  usage: Record<string, number>;
  limits: Record<string, number>;
};

export function AccountSettings({
  profile,
  workspace,
  canManage,
  usage,
  limits,
}: AccountSettingsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      setBusy(false);
    }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(async () => {
      await apiRequest("/api/account/settings", {
        method: "PATCH",
        body: JSON.stringify({
          profile: {
            name: form.get("name"),
            image: form.get("image") || null,
          },
        }),
      });
      setNotice("Perfil atualizado.");
      router.refresh();
    });
  }

  function saveWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(async () => {
      await apiRequest("/api/account/settings", {
        method: "PATCH",
        body: JSON.stringify({
          workspace: {
            name: form.get("workspaceName"),
            slug: form.get("slug") || null,
            logoUrl: form.get("logoUrl") || null,
            timezone: form.get("timezone"),
            locale: form.get("locale"),
          },
          preferences: { notifications: form.get("notifications") === "on" },
        }),
      });
      setNotice("Workspace e preferências atualizados.");
      router.refresh();
    });
  }

  function deleteAccount() {
    void run(async () => {
      await apiRequest("/api/account/settings", {
        method: "DELETE",
        body: JSON.stringify({ confirmation }),
      });
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <section className="workspace-page account-settings">
      <header className="workspace-page-heading">
        <div>
          <span className="eyebrow">Configurações</span>
          <h1>Minha conta</h1>
          <p>Gerencie seu perfil, workspace e preferências.</p>
        </div>
      </header>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {notice ? <p className="status-success" role="status">{notice}</p> : null}
      <div className="account-settings-grid">
        <section className="workspace-panel">
          <h2>Perfil</h2>
          <form onSubmit={saveProfile} className="account-settings-form">
            <label>Nome<input name="name" required maxLength={120} defaultValue={profile.name} /></label>
            <label>E-mail<input value={profile.email} disabled /></label>
            <label>Avatar (URL)<input name="image" type="url" defaultValue={profile.image ?? ""} placeholder="https://" /></label>
            <button className="button" disabled={busy}>Salvar perfil</button>
          </form>
        </section>
        <section className="workspace-panel">
          <h2>Segurança</h2>
          <p className="workspace-data-note">Senha e sessões são gerenciadas pelo provedor de autenticação configurado neste ambiente.</p>
        </section>
        <section id="preferencias" className="workspace-panel account-settings-wide">
          <h2>Workspace</h2>
          {canManage ? (
            <form onSubmit={saveWorkspace} className="account-settings-form account-settings-form-grid">
              <label>Nome<input name="workspaceName" required maxLength={120} defaultValue={workspace.name} /></label>
              <label>Slug<input name="slug" minLength={3} maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={workspace.slug ?? ""} /></label>
              <label>Logo (URL)<input name="logoUrl" type="url" defaultValue={workspace.logoUrl ?? ""} placeholder="https://" /></label>
              <label>Timezone<select name="timezone" defaultValue={workspace.timezone}><option value="America/Sao_Paulo">America/Sao_Paulo</option><option value="UTC">UTC</option><option value="America/New_York">America/New_York</option><option value="Europe/Lisbon">Europe/Lisbon</option></select></label>
              <label>Idioma<select name="locale" defaultValue={workspace.locale}><option value="pt-BR">Português (Brasil)</option><option value="en">English</option><option value="es">Español</option></select></label>
              <label className="account-settings-toggle"><input name="notifications" type="checkbox" defaultChecked={workspace.notifications} /> Receber notificações de produto</label>
              <button className="button" disabled={busy}>Salvar workspace</button>
            </form>
          ) : <p className="workspace-data-note">Peça a um administrador para alterar as configurações compartilhadas.</p>}
        </section>
        <section className="workspace-panel account-settings-wide">
          <h2>Plano</h2>
          <p className="workspace-data-note">Plano atual: <strong>{workspace.plan === "premium" ? "Premium" : "Free"}</strong></p>
          <dl className="account-usage-list">
            {Object.entries(limits).map(([resource, limit]) => <div key={resource}><dt>{resource}</dt><dd>{usage[resource] ?? 0} de {limit}</dd></div>)}
          </dl>
          {workspace.plan === "free" ? <Link className="button" href="/upgrade">Conhecer Premium</Link> : null}
        </section>
        <section className="workspace-panel account-settings-wide account-danger-zone">
          <h2>Danger Zone</h2>
          <SignOutButton />
          <details>
            <summary>Excluir conta</summary>
            <p>Digite EXCLUIR para remover sua conta e workspaces sem outros membros.</p>
            <label>Confirmação<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <button className="button button-quiet danger-text" type="button" disabled={busy || confirmation !== "EXCLUIR"} onClick={deleteAccount}>Excluir conta</button>
          </details>
        </section>
      </div>
    </section>
  );
}