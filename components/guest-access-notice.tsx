"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function GuestAccessNotice({error}:{error:string}) {
 const path=usePathname();
 if(error.includes("uso gratuito"))return <div className="sp-guest-notice" role="status"><strong>Continue no seu perfil</strong><p>Você já experimentou seu link gratuito. Entre para criar e organizar mais links.</p><Link className="button" href={`/entrar?next=${encodeURIComponent(path)}`}>Entrar ou criar conta</Link></div>;
 if(path.startsWith("/untrack"))return null;
 return <p className="sp-guest-note">Sem login: 1 uso gratuito. <Link href={`/entrar?next=${encodeURIComponent(path)}`}>Entre para continuar com mais links.</Link></p>;
}
