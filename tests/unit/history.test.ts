import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addHistory, readHistory, removeHistory } from "@/lib/client/history";

const KEY = "arrume-meu-link:history";
const item = {
  originalUrl: "https://example.com/?utm_source=x",
  cleanUrl: "https://example.com/",
};

describe("histórico local", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("limita a dez itens e remove somente o item escolhido", () => {
    for (let i = 0; i < 12; i++)
      addHistory({ ...item, cleanUrl: `https://example.com/${i}` });
    const history = readHistory();
    expect(history).toHaveLength(10);
    expect(history[0].cleanUrl).toBe("https://example.com/11");
    expect(removeHistory(history[0].id)).toHaveLength(9);
    expect(readHistory()[0].cleanUrl).toBe("https://example.com/10");
  });

  it("ignora JSON corrompido e registros com URLs inseguras", () => {
    localStorage.setItem(KEY, "{");
    expect(readHistory()).toEqual([]);
    const [valid] = addHistory(item);
    localStorage.setItem(
      KEY,
      JSON.stringify([
        null,
        {},
        { ...valid, cleanUrl: "javascript:alert(1)" },
        valid,
      ]),
    );
    expect(readHistory()).toEqual([valid]);
  });

  it("não lança erros quando o navegador bloqueia o armazenamento", () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(readHistory()).toEqual([]);
    expect(addHistory(item)).toEqual([]);
    expect(removeHistory("missing")).toEqual([]);
  });
});
