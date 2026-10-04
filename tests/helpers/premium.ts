import { PrismaClient } from "@prisma/client";
export async function testDatabase<T>(
  work: (db: PrismaClient) => Promise<T>,
): Promise<T> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error("A dedicated _test database is required.");
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await work(db);
  } finally {
    await db.$disconnect();
  }
}
export async function grantTestPremium(workspaceId: string) {
  await testDatabase(async (db) => {
    const owner = await db.workspaceMember.findFirst({
      where: { workspaceId, role: "owner" },
      select: { userId: true },
    });
    if (!owner) throw new Error("Workspace de teste sem owner.");
    await db.user.update({
      where: { id: owner.userId },
      data: { plan: "premium" },
    });
  });
}
