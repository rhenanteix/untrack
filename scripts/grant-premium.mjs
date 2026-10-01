import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());

const db = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    const workspaces = await db.workspace.findMany({
      include: { members: { include: { user: true } } },
    });
    console.log("Uso: node scripts/grant-premium.mjs <email>");
    console.log("Workspaces disponíveis:");
    for (const ws of workspaces) {
      for (const m of ws.members) {
        console.log(`  ${m.user.email}  =>  ${ws.id}  (${ws.plan})`);
      }
    }
    await db.$disconnect();
    return;
  }

  const membership = await db.workspaceMember.findFirst({
    where: { user: { email } },
    include: { workspace: true },
  });

  if (!membership) {
    console.log(`Usuário ${email} não encontrado.`);
    await db.$disconnect();
    process.exit(1);
  }

  const updated = await db.workspace.update({
    where: { id: membership.workspaceId },
    data: { plan: "pro" },
  });

  console.log(
    `Workspace ${updated.id} de ${email} atualizado para plano: ${updated.plan}`,
  );
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
