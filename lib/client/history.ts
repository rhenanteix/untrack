import { webUrlSchema } from "@/modules/validation/url-validation";

export interface HistoryItem {
  id: string;
  originalUrl: string;
  cleanUrl: string;
  createdAt: string;
}

const KEY = "arrume-meu-link:history";
const LIMIT = 10;

function isHistoryItem(value: unknown): value is HistoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<HistoryItem>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.createdAt === "string" &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    webUrlSchema.safeParse(item.originalUrl).success &&
    webUrlSchema.safeParse(item.cleanUrl).success
  );
}

export function readHistory(): HistoryItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter(isHistoryItem).slice(0, LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function addHistory(item: Omit<HistoryItem, "id" | "createdAt">) {
  const next: HistoryItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  if (!isHistoryItem(next)) return readHistory();
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify([next, ...readHistory()].slice(0, LIMIT)),
    );
  } catch {
    // A disabled or full storage must never discard a successful URL analysis.
  }
  return readHistory();
}

export function removeHistory(id: string) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(readHistory().filter((item) => item.id !== id)),
    );
  } catch {
    // Keep the actual stored history visible if the browser refuses a write.
  }
  return readHistory();
}
