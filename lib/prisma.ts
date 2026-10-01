import { PrismaClient, Prisma } from "@prisma/client";

const clientSchema = JSON.stringify(
  Prisma.dmmf.datamodel.models.map((model) => ({
    name: model.name,
    fields: model.fields.map(
      (field) =>
        `${field.name}:${field.type}:${field.isList}:${field.isRequired}`,
    ),
  })),
);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaModels?: string;
};

export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL)
    throw new Error("Configure DATABASE_URL para os recursos de conta.");
  // A regenerated client can add models while Next keeps its development global.
  // Retire the old singleton instead of serving undefined model delegates.
  const models = clientSchema;
  if (globalForPrisma.prisma && globalForPrisma.prismaModels !== models) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = undefined;
  }
  globalForPrisma.prisma ??= new PrismaClient();
  globalForPrisma.prismaModels = models;
  return globalForPrisma.prisma;
}
