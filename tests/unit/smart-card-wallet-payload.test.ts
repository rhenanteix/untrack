import { describe, expect, it } from "vitest";
import { GoogleWalletService } from "@/modules/smart-cards/wallet";

describe("Google Wallet Smart Card payload", () => {
  it("uses the tracked QR URL and only supported Generic Object fields", () => {
    const service = new GoogleWalletService();
    const object = service.buildObject(
      {
        id: "card_1",
        slug: "ana-silva",
        firstName: "Ana",
        lastName: "Silva",
        headline: "Product Designer",
        company: "LinkOr",
        bio: "",
        email: "ana@linkor.com",
        phone: null,
        websiteUrl: null,
        logoUrl: "https://cdn.linkor.com/logo.png",
        contactPoints: [],
        theme: { background: "#1f5a45" },
        qrAsset: { encodedUrl: "https://linkor.test/q/tracked-qr" },
      },
      "123.linkor-card-1",
    );

    expect(object).toMatchObject({
      id: "123.linkor-card-1",
      genericType: "GENERIC_OTHER",
      header: { defaultValue: { value: "Ana Silva" } },
      barcode: { type: "QR_CODE", value: "https://linkor.test/q/tracked-qr" },
      logo: { sourceUri: { uri: "https://cdn.linkor.com/logo.png" } },
    });
    expect(object.linksModuleData.uris).toEqual([
      expect.objectContaining({ description: "Abrir Smart Card" }),
    ]);
  });
});