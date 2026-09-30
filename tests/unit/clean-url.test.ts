import { describe, expect, it } from "vitest";
import { analyzeUrl, cleanUrl } from "@/modules/links/clean-url";
import { getTrackerCategory } from "@/modules/links/tracker-categories";

describe("cleanUrl", () => {
  it("remove rastreadores conhecidos e por prefixo sem diferenciar maiúsculas", () => {
    const result = cleanUrl(
      "https://example.com/produto?utm_source=newsletter&FBCLID=abc&pk_campaign=sale&id=42",
    );

    expect(result.cleanedUrl).toBe("https://example.com/produto?id=42");
    expect(result.removed).toEqual([
      { name: "utm_source", category: "utm" },
      { name: "FBCLID", category: "meta" },
      { name: "pk_campaign", category: "analytics" },
    ]);
    expect(result.removedCount).toBe(3);
    expect(result.changed).toBe(true);
  });

  it("preserva parâmetros legítimos, repetidos, fragmento, porta e caminho", () => {
    const result = cleanUrl(
      "https://example.com:8443/a%20b?q=camisa&q=azul&page=2&utm_medium=cpc#detalhes",
    );

    expect(result.cleanedUrl).toBe(
      "https://example.com:8443/a%20b?q=camisa&q=azul&page=2#detalhes",
    );
    expect(new URL(result.cleanedUrl).searchParams.getAll("q")).toEqual([
      "camisa",
      "azul",
    ]);
  });

  it("mantém rastreadores de categorias não selecionadas", () => {
    const result = cleanUrl(
      "https://example.com/?utm_source=x&gclid=y&fbclid=z",
      ["utm", "meta"],
    );

    expect(result.cleanedUrl).toBe("https://example.com/?gclid=y");
    expect(result.removed.map(({ name }) => name)).toEqual([
      "utm_source",
      "fbclid",
    ]);
  });

  it("não altera URL sem rastreadores", () => {
    const input = "https://example.com/search?q=rel%C3%B3gio&sort=price#top";
    const result = cleanUrl(input);

    expect(result).toMatchObject({
      originalUrl: input,
      cleanedUrl: input,
      changed: false,
      removed: [],
      removedCount: 0,
    });
  });

  it("calcula a análise de parâmetros removidos e preservados", () => {
    const result = analyzeUrl(
      "https://example.com/?utm_source=a&utm_campaign=b&id=7&lang=pt-BR",
    );

    expect(result.statistics).toMatchObject({
      totalParameters: 4,
      trackingParameters: 2,
      preservedParameters: 2,
    });
    expect(result.statistics.charactersRemoved).toBeGreaterThan(0);
    expect(result.removedParameters).toEqual(["utm_source", "utm_campaign"]);
    expect(result.preservedParameters).toEqual(["id", "lang"]);
  });

  it.each([
    ["UTM_CUSTOM", "utm"],
    ["hsa_acc", "google"],
    ["mtm_campaign", "analytics"],
    ["trk_contact", null],
    ["produto", null],
  ])("classifica %s como %s", (parameter, category) => {
    expect(getTrackerCategory(parameter)).toEqual(category);
  });

  it("conta ocorrências, não nomes, para que a estatística feche", () => {
    const result = analyzeUrl(
      "https://example.com/?utm_source=a&utm_source=b&id=1&id=2&q=x",
    );

    // 5 entradas: 2 removidas (utm_source repetido) + 3 preservadas (id x2, q).
    expect(result.statistics.totalParameters).toBe(5);
    expect(result.statistics.trackingParameters).toBe(2);
    expect(result.statistics.preservedParameters).toBe(3);
    expect(result.statistics.trackingParameters).toBe(
      result.statistics.totalParameters - result.statistics.preservedParameters,
    );
    // A lista de exibição não repete o mesmo nome.
    expect(result.removedParameters).toEqual(["utm_source"]);
    expect(result.preservedParameters).toEqual(["id", "q"]);
  });

  it("mantém a contagem correta quando um tracker se repete", () => {
    const result = cleanUrl("https://example.com/?fbclid=a&fbclid=b&id=1");

    expect(result.removed).toEqual([{ name: "fbclid", category: "meta" }]);
    expect(result.removedCount).toBe(2);
    expect(result.cleanedUrl).toBe("https://example.com/?id=1");
  });
});
