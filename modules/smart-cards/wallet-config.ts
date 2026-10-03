export const walletProviders = ["apple", "google"] as const;

export type WalletProvider = (typeof walletProviders)[number];
export type WalletConfigurationState =
  | "not_configured"
  | "configuration_pending"
  | "test_mode"
  | "ready"
  | "error";

export type WalletConfiguration = {
  provider: WalletProvider;
  state: WalletConfigurationState;
  message: string;
};

function environmentValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

function decodeBase64(value: string) {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function configurationState(
  provider: WalletProvider,
  required: string[],
  invalid: boolean,
): WalletConfiguration {
  const configured = required.filter((name) => Boolean(environmentValue(name)));
  if (configured.length === 0) {
    return {
      provider,
      state: "not_configured",
      message: "Configuração necessária.",
    };
  }
  if (configured.length !== required.length) {
    return {
      provider,
      state: "configuration_pending",
      message: "Configuração pendente: complete as credenciais do servidor.",
    };
  }
  if (invalid) {
    return {
      provider,
      state: "error",
      message: "A configuração do servidor é inválida.",
    };
  }

  const mode = environmentValue("SMART_CARD_WALLET_MODE");
  if (mode === "test") {
    return {
      provider,
      state: "test_mode",
      message: "Integração configurada em modo de teste.",
    };
  }
  if (mode === "live") {
    return {
      provider,
      state: "ready",
      message: "Integração configurada e pronta para emissão.",
    };
  }
  return {
    provider,
    state: "configuration_pending",
    message: "Defina o modo de emissão no servidor.",
  };
}

export function appleWalletConfiguration(): WalletConfiguration {
  const required = [
    "APPLE_WALLET_PASS_TYPE_IDENTIFIER",
    "APPLE_WALLET_TEAM_IDENTIFIER",
    "APPLE_WALLET_ORGANIZATION_NAME",
    "APPLE_WALLET_SIGNER_CERTIFICATE_BASE64",
    "APPLE_WALLET_SIGNER_KEY_BASE64",
    "APPLE_WALLET_WWDR_CERTIFICATE_BASE64",
  ];
  const passTypeIdentifier = environmentValue(
    "APPLE_WALLET_PASS_TYPE_IDENTIFIER",
  );
  const teamIdentifier = environmentValue("APPLE_WALLET_TEAM_IDENTIFIER");
  const signerCertificate = decodeBase64(
    environmentValue("APPLE_WALLET_SIGNER_CERTIFICATE_BASE64"),
  );
  const signerKey = decodeBase64(
    environmentValue("APPLE_WALLET_SIGNER_KEY_BASE64"),
  );
  const wwdrCertificate = decodeBase64(
    environmentValue("APPLE_WALLET_WWDR_CERTIFICATE_BASE64"),
  );
  return configurationState(
    "apple",
    required,
    !/^pass\.[A-Za-z0-9.-]+$/.test(passTypeIdentifier) ||
      !/^[A-Z0-9]{10}$/.test(teamIdentifier) ||
      !signerCertificate.includes("BEGIN CERTIFICATE") ||
      !signerKey.includes("BEGIN") ||
      !signerKey.includes("PRIVATE KEY") ||
      !wwdrCertificate.includes("BEGIN CERTIFICATE"),
  );
}

export function googleWalletConfiguration(): WalletConfiguration {
  const required = [
    "GOOGLE_WALLET_PROJECT_ID",
    "GOOGLE_WALLET_ISSUER_ID",
    "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64",
  ];
  const issuerId = environmentValue("GOOGLE_WALLET_ISSUER_ID");
  const serviceAccountEmail = environmentValue(
    "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
  );
  const privateKey = decodeBase64(
    environmentValue("GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64"),
  );
  return configurationState(
    "google",
    required,
    !/^\d+$/.test(issuerId) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(serviceAccountEmail) ||
      !privateKey.includes("BEGIN PRIVATE KEY"),
  );
}

export function walletConfiguration(provider: WalletProvider) {
  return provider === "apple"
    ? appleWalletConfiguration()
    : googleWalletConfiguration();
}

export function walletConfigurations() {
  return walletProviders.map(walletConfiguration);
}

export function walletCanIssue(configuration: WalletConfiguration) {
  return configuration.state === "test_mode" || configuration.state === "ready";
}

export function appleWalletCredentials() {
  return {
    passTypeIdentifier: environmentValue("APPLE_WALLET_PASS_TYPE_IDENTIFIER"),
    teamIdentifier: environmentValue("APPLE_WALLET_TEAM_IDENTIFIER"),
    organizationName: environmentValue("APPLE_WALLET_ORGANIZATION_NAME"),
    signerCertificate: Buffer.from(
      environmentValue("APPLE_WALLET_SIGNER_CERTIFICATE_BASE64"),
      "base64",
    ),
    signerKey: Buffer.from(
      environmentValue("APPLE_WALLET_SIGNER_KEY_BASE64"),
      "base64",
    ),
    wwdrCertificate: Buffer.from(
      environmentValue("APPLE_WALLET_WWDR_CERTIFICATE_BASE64"),
      "base64",
    ),
    signerKeyPassphrase:
      environmentValue("APPLE_WALLET_SIGNER_KEY_PASSPHRASE") || undefined,
  };
}

export function googleWalletCredentials() {
  return {
    projectId: environmentValue("GOOGLE_WALLET_PROJECT_ID"),
    issuerId: environmentValue("GOOGLE_WALLET_ISSUER_ID"),
    serviceAccountEmail: environmentValue(
      "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
    ),
    privateKey: decodeBase64(
      environmentValue("GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64"),
    ),
  };
}