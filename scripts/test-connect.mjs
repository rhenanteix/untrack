import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd());
const original = process.env.DATABASE_URL;
const raw = process.env.TEST_DATABASE_URL;
if (!raw)
  throw new Error(
    "TEST_DATABASE_URL is required; no fallback to DATABASE_URL.",
  );
const url = new URL(raw);
if (
  !decodeURIComponent(url.pathname).endsWith("_test") ||
  (original && new URL(original).pathname === url.pathname)
)
  throw new Error("Use a separate database whose name ends with _test.");
if (url.hostname === "localhost") url.hostname = "127.0.0.1";
url.searchParams.set("connection_limit", "4");
url.searchParams.set("pool_timeout", "30");
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  CONNECT_INTEGRATION_TESTS: "1",
  NODE_ENV: "test",
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
};
for (const args of [
  ["prisma", "migrate", "deploy"],
  ["vitest", "run", "tests/integration/connect.test.ts"],
]) {
  const result = spawnSync("npx", args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
