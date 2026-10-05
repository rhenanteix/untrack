import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envFiles = [".env.local", ".env.test", ".env"];
  for (const file of envFiles) {
    try {
      const path = resolve(process.cwd(), file);
      const content = readFileSync(path, "utf-8");
      for (const line of content.split("\n")) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^"|"$/g, "");
          if (!process.env[key]) process.env[key] = value;
        }
      }
    } catch {
      // file doesn't exist, continue
    }
  }
}

loadEnv();
const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const prisma = databaseUrl
  ? new PrismaClient({ datasourceUrl: databaseUrl })
  : new PrismaClient();

export default async function globalSetup() {
  await prisma.anonymousUse.deleteMany();
  await prisma.$disconnect();
}
