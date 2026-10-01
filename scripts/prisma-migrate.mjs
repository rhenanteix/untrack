import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";

nextEnv.loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const isMigration = args.some(
  (arg) => arg === "migrate" || arg.includes("migrate"),
);

if (isMigration && process.env.DATABASE_URL?.includes("-pooler")) {
  const url = new URL(process.env.DATABASE_URL);
  url.hostname = url.hostname.replace("-pooler.", ".");
  delete url.searchParams.channel_binding;
  process.env.DATABASE_URL = url.toString();
  process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = "true";
}

const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", ...args],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
