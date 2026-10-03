import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appleWalletConfiguration,
  googleWalletConfiguration,
} from "@/modules/smart-cards/wallet-config";

const walletEnvironment = [
  "SMART_CARD_WALLET_MODE",
  "APPLE_WALLET_PASS_TYPE_IDENTIFIER",
  "APPLE_WALLET_TEAM_IDENTIFIER",
  "APPLE_WALLET_ORGANIZATION_NAME",
  "APPLE_WALLET_SIGNER_CERTIFICATE_BASE64",
  "APPLE_WALLET_SIGNER_KEY_BASE64",
  "APPLE_WALLET_WWDR_CERTIFICATE_BASE64",
  "GOOGLE_WALLET_PROJECT_ID",
  "GOOGLE_WALLET_ISSUER_ID",
  "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64",
] as const;

function base64(value: string) {
  return Buffer.from(value).toString("base64");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Smart Card Wallet configuration", () => {
  it("does not claim Wallet is configured without credentials", () => {
    for (const name of walletEnvironment) vi.stubEnv(name, "");
    expect(appleWalletConfiguration()).toMatchObject({
      provider: "apple",
      state: "not_configured",
    });
    expect(googleWalletConfiguration()).toMatchObject({
      provider: "google",
      state: "not_configured",
    });
  });

  it("keeps partial configuration pending", () => {
    for (const name of walletEnvironment) vi.stubEnv(name, "");
    vi.stubEnv("APPLE_WALLET_PASS_TYPE_IDENTIFIER", "pass.com.linkor.card");
    expect(appleWalletConfiguration().state).toBe("configuration_pending");
  });

  it("recognizes a complete Apple test configuration", () => {
    for (const name of walletEnvironment) vi.stubEnv(name, "");
    vi.stubEnv("SMART_CARD_WALLET_MODE", "test");
    vi.stubEnv("APPLE_WALLET_PASS_TYPE_IDENTIFIER", "pass.com.linkor.card");
    vi.stubEnv("APPLE_WALLET_TEAM_IDENTIFIER", "AB12CD34EF");
    vi.stubEnv("APPLE_WALLET_ORGANIZATION_NAME", "LinkOr");
    vi.stubEnv(
      "APPLE_WALLET_SIGNER_CERTIFICATE_BASE64",
      base64("-----BEGIN CERTIFICATE-----\ncertificate"),
    );
    vi.stubEnv(
      "APPLE_WALLET_SIGNER_KEY_BASE64",
      base64("-----BEGIN PRIVATE KEY-----\nkey"),
    );
    vi.stubEnv(
      "APPLE_WALLET_WWDR_CERTIFICATE_BASE64",
      base64("-----BEGIN CERTIFICATE-----\nwwdr"),
    );
    expect(appleWalletConfiguration().state).toBe("test_mode");
  });

  it("reports malformed Google credentials as an error", () => {
    for (const name of walletEnvironment) vi.stubEnv(name, "");
    vi.stubEnv("SMART_CARD_WALLET_MODE", "live");
    vi.stubEnv("GOOGLE_WALLET_PROJECT_ID", "linkor-wallet");
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", "1234567890");
    vi.stubEnv(
      "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
      "wallet@linkor.iam.gserviceaccount.com",
    );
    vi.stubEnv("GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64", "invalid");
    expect(googleWalletConfiguration().state).toBe("error");
  });
});