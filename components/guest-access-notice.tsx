"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiX } from "react-icons/fi";
import { useEffect } from "react";
import { analytics } from "@/lib/client/analytics";

export function GuestSignupPrompt({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const path = usePathname();

	useEffect(() => {
		if (open) analytics.track("signup_prompt_shown");
	}, [open]);

	if (!open) return null;
	const next = encodeURIComponent(path);
	return (
		<div className="guest-signup-backdrop" role="presentation">
			<section
				className="guest-signup-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="guest-signup-heading"
			>
				<button
					className="guest-signup-close"
					type="button"
					aria-label="Fechar"
					title="Fechar"
					onClick={onClose}
				>
					<FiX aria-hidden="true" />
				</button>
				<h2 id="guest-signup-heading">Continue gratuitamente</h2>
				<p>
					Você já experimentou a ferramenta. Crie sua conta grátis para salvar
					seus links, acompanhar resultados e continuar usando a plataforma.
				</p>
				<div className="guest-signup-actions">
					<Link
						className="button"
						href={`/cadastro?next=${next}`}
						onClick={() => analytics.track("signup_started")}
					>
						Criar conta grátis
					</Link>
					<Link
						className="button button-secondary"
						href={`/entrar?next=${next}`}
						onClick={() => analytics.track("signup_started")}
					>
						Entrar
					</Link>
				</div>
			</section>
		</div>
	);
}

export function GuestAccessNotice({ error }: { error: string }) {
	const path = usePathname();
	if (error.includes("uso gratuito"))
		return (
			<div className="sp-guest-notice" role="status">
				<strong>Continue gratuitamente</strong>
				<p>Você já experimentou a ferramenta. Entre ou crie sua conta para continuar.</p>
				<div className="action-row">
					<Link className="button" href={`/cadastro?next=${encodeURIComponent(path)}`}>Criar conta grátis</Link>
					<Link className="button button-secondary" href={`/entrar?next=${encodeURIComponent(path)}`}>Entrar</Link>
				</div>
			</div>
		);
	if (path.startsWith("/untrack")) return null;
	return <p className="sp-guest-note">Sem login: 1 uso gratuito. <Link href={`/entrar?next=${encodeURIComponent(path)}`}>Entre para continuar com mais links.</Link></p>;
}
