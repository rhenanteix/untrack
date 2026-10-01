import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

nextEnv.loadEnvConfig(process.cwd());

const db = new PrismaClient();

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL?.replace(/:.*@/, ":****@"));

  const email = process.argv[2] ?? "teste@localhost";
  const password = process.argv[3] ?? "123456789012";
  const name = process.argv[4] ?? "Teste Local";

  const existing = await db.user.findUnique({ where: { email } });
  console.log("Usuário existente:", existing);
  if (existing) {
    console.log(`Usuário ${email} já existe.`);
    await db.$disconnect();
    return;
  }

  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);

  console.log("Criando usuário:", { userId, email, name });

  await db.$transaction(async (tx) => {
    console.log("Criando usuário no banco...");
    const user = await tx.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: true,
        accounts: {
          create: {
            id: crypto.randomUUID(),
            accountId: email,
            providerId: "email",
            password: passwordHash,
          },
        },
      },
    });
    console.log("Usuário criado:", user.email);

    const workspaceId = crypto.randomUUID();
    console.log("Criando workspace:", workspaceId);
    const workspace = await tx.workspace.create({
      data: {
        id: workspaceId,
        name: `${name} Workspace`,
        members: {
          create: {
            userId,
            role: "owner",
          },
        },
        usage: {
          create: {
            resource: "members",
            count: 1,
          },
        },
      },
    });
    console.log("Workspace criado:", workspace.id);
  });

  console.log(`Usuário criado: ${email} / ${password}`);
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("Erro no seed:", error);
  await db.$disconnect();
  process.exit(1);
});
