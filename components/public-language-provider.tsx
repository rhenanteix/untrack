"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import {
  isPublicLocale,
  publicCopy,
  type PublicLocale,
} from "@/lib/public-i18n";

type PublicLanguageContext = {
  locale: PublicLocale;
  setLocale: (locale: PublicLocale) => void;
  copy: (typeof publicCopy)[PublicLocale];
};

const LanguageContext = createContext<PublicLanguageContext | null>(null);
const storageKey = "untrack.public-locale";
const localeChangeEvent = "untrack:public-locale-changed";

function preferredLocale(): PublicLocale {
  if (typeof window === "undefined") return "pt-BR";
  const stored = window.localStorage.getItem(storageKey);
  if (stored && isPublicLocale(stored)) return stored;
  if (navigator.language.toLowerCase().startsWith("es")) return "es";
  if (navigator.language.toLowerCase().startsWith("en")) return "en";
  return "pt-BR";
}

function subscribeToLocale(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(localeChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(localeChangeEvent, onStoreChange);
  };
}

function saveLocale(locale: PublicLocale) {
  window.localStorage.setItem(storageKey, locale);
  window.dispatchEvent(new Event(localeChangeEvent));
}

export function PublicLanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore<PublicLocale>(
    subscribeToLocale,
    preferredLocale,
    (): PublicLocale => "pt-BR",
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale: saveLocale, copy: publicCopy[locale] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function usePublicLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("PublicLanguageProvider is required.");
  return context;
}