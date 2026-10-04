import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd());

const db = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    const users = await db.user.findMany({ orderBy: { email: "asc" } });
    console.log("Uso: node scripts/grant-premium.mjs <email>");
    console.log("Contas disponíveis:");
    for (const user of users) console.log(`  ${user.email}  (${user.plan})`);
    await db.$disconnect();
    return;
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`Usuário ${email} não encontrado.`);
    await db.$disconnect();
    process.exit(1);
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { plan: "premium" },
  });

  console.log(
    `Conta ${updated.id} de ${email} atualizada para plano: ${updated.plan}`,
  );
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
