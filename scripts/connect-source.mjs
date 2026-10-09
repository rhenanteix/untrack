import { open, readFile, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";

// The config contains an operation/workspace/source policy, never a credential.
const [configFile, outputFile] = process.argv.slice(2);
if (!configFile || !outputFile)
  throw new Error(
    "Usage: node scripts/connect-source.mjs config.json /outside-checkout/source-credential.json",
  );
const destination = resolve(outputFile);
if (destination.startsWith(`${process.cwd()}${sep}`))
  throw new Error("Store credentials outside the checkout and public assets.");
const base = new URL(process.env.CONNECT_BASE_URL ?? "http://localhost:3000");
if (
  base.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(base.hostname)
)
  throw new Error("Remote provisioning requires HTTPS.");
const secret = process.env.CONNECT_ADMIN_SECRET;
if (!secret || secret.length < 32)
  throw new Error("CONNECT_ADMIN_SECRET is required.");
const configuration = JSON.parse(await readFile(configFile, "utf8"));
const output = await open(destination, "wx", 0o600);
try {
  const response = await fetch(new URL("/api/internal/connect/sources", base), {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(configuration),
  });
  if (!response.ok)
    throw new Error(
      `Provisioning failed (${response.status}); no credential logged.`,
    );
  const result = await response.json();
  await output.writeFile(`${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `Source ${result.source.id} configured. Credential artifact written with mode 0600.`,
  );
} catch (error) {
  await output.close();
  await unlink(destination);
  throw error;
} finally {
  await output.close();
}
