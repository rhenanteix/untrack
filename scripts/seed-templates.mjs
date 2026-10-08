import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

nextEnv.loadEnvConfig(process.cwd());
const templates = JSON.parse(
  await readFile(
    new URL("../prisma/seeds/templates.json", import.meta.url),
    "utf8",
  ),
);
const db = new PrismaClient();
try {
  await db.$transaction(
    templates.map((template) =>
      db.smartPageTemplate.upsert({
        where: { slug: template.slug },
        create: {
          ...template,
          published: true,
          publishedAt: new Date("2026-10-01T00:00:00Z"),
        },
        // Preserve edits and publication decisions on subsequent seed runs.
        update: {},
      }),
    ),
  );
  console.log(`Seed complete: ${templates.length} template slugs ensured.`);
} finally {
  await db.$disconnect();
}
