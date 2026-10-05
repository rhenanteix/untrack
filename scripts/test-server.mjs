import nextEnv from "@next/env";
import { spawn, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test")) {
  throw new Error(
    "Defina TEST_DATABASE_URL com um banco separado cujo nome termine em _test.",
  );
}
if (testUrl === process.env.DATABASE_URL)
  throw new Error(
    "O banco de testes deve ser diferente do banco da aplicação.",
  );
const env = { ...process.env, DATABASE_URL: testUrl };
const migration = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { stdio: "inherit", env },
);
if (migration.status !== 0) process.exit(migration.status ?? 1);
const prisma = new PrismaClient({ datasourceUrl: testUrl });
await prisma.anonymousUse.deleteMany();
await prisma.$disconnect();
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", "3100"],
  { stdio: "inherit", env },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
