"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiClock, FiHeart } from "react-icons/fi";
import { apiRequest } from "./shared";

type Resource = {
  id: string;
  name: string;
  description: string;
  href: string;
  resourceType: string;
};

export function FavoritesDashboard() {
  const [favorites, setFavorites] = useState<Resource[]>([]);
  const [recent, setRecent] = useState<Resource[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiRequest<{ items: Resource[] }>("/api/resources?action=favorites", {
        signal: controller.signal,
      }),
      apiRequest<{ items: Resource[] }>("/api/resources?action=recent", {
        signal: controller.signal,
      }),
    ])
      .then(([favoriteResult, recentResult]) => {
        if (!controller.signal.aborted) {
          setFavorites(favoriteResult.items);
          setRecent(recentResult.items);
        }
      })
      .catch((loadError: Error) => {
        if (!controller.signal.aborted) setError(loadError.message);
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="workspace-page intelligence-page">
      <header className="workspace-page-heading">
        <div>
          <span className="eyebrow">Acesso rápido</span>
          <h1>Favoritos</h1>
          <p>Retome os recursos importantes e os que você viu recentemente.</p>
        </div>
      </header>
      {error && (
        <section className="workspace-panel" role="alert">
          <h2>Não foi possível carregar</h2>
          <p>{error}</p>
        </section>
      )}
      <div className="intelligence-grid">
        <section className="workspace-panel resource-shelf">
          <div className="workspace-panel-heading">
            <div>
              <span className="eyebrow">Fixados</span>
              <h2>Favoritos</h2>
            </div>
            <FiHeart aria-hidden="true" />
          </div>
          <ResourceList items={favorites} empty="Favorite um Project ou recurso para mantê-lo à mão." />
        </section>
        <section className="workspace-panel resource-shelf">
          <div className="workspace-panel-heading">
            <div>
              <span className="eyebrow">Histórico</span>
              <h2>Vistos recentemente</h2>
            </div>
            <FiClock aria-hidden="true" />
          </div>
          <ResourceList items={recent} empty="Os recursos que você abrir aparecerão aqui." />
        </section>
      </div>
    </section>
  );
}

function ResourceList({ items, empty }: { items: Resource[]; empty: string }) {
  return items.length ? (
    <ul className="intelligence-resources">
      {items.map((item) => (
        <li key={`${item.resourceType}:${item.id}`}>
          <Link href={item.href}>{item.name}</Link>
          <small>{item.resourceType} · {item.description}</small>
        </li>
      ))}
    </ul>
  ) : (
    <p>{empty}</p>
  );
}