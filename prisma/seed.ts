import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function upsertUser(input: {
  username: string;
  displayName: string;
  password: string;
  role: "ADMIN" | "PLAYER";
}) {
  return prisma.user.upsert({
    where: { username: input.username },
    update: {
      displayName: input.displayName,
      role: input.role,
      active: true,
    },
    create: {
      username: input.username,
      displayName: input.displayName,
      passwordHash: await hashPassword(input.password),
      role: input.role,
    },
  });
}

async function main() {
  const admin = await upsertUser({
    username: "admin",
    displayName: "管理员",
    password: "admin123",
    role: "ADMIN",
  });
  const koko = await upsertUser({
    username: "koko",
    displayName: "koko",
    password: "player123",
    role: "PLAYER",
  });
  const xinqing = await upsertUser({
    username: "xinqing",
    displayName: "心情",
    password: "player123",
    role: "PLAYER",
  });

  const lol = await prisma.category.upsert({
    where: { name: "lol" },
    update: {
      platformCommissionRateBps: 1000,
      active: true,
    },
    create: {
      name: "lol",
      platformCommissionRateBps: 1000,
    },
  });

  await prisma.category.upsert({
    where: { name: "王者荣耀" },
    update: {
      platformCommissionRateBps: 1000,
      active: true,
    },
    create: {
      name: "王者荣耀",
      platformCommissionRateBps: 1000,
    },
  });

  await prisma.playerPricingOverride.upsert({
    where: { playerId_categoryId: { playerId: xinqing.id, categoryId: lol.id } },
    update: { platformCommissionRateBps: 1000 },
    create: {
      playerId: xinqing.id,
      categoryId: lol.id,
      platformCommissionRateBps: 1000,
    },
  });

  const customer = await prisma.customer.upsert({
    where: { id: "seed-customer-chen" },
    update: {
      name: "陈发发",
      status: "CONFIRMED",
      ownerId: koko.id,
    },
    create: {
      id: "seed-customer-chen",
      name: "陈发发",
      wechat: "chenfafa",
      note: "示例老板",
      status: "CONFIRMED",
      ownerId: koko.id,
    },
  });

  await prisma.customerAlias.upsert({
    where: { customerId_alias: { customerId: customer.id, alias: "发发" } },
    update: {},
    create: {
      customerId: customer.id,
      alias: "发发",
    },
  });

  await prisma.setting.upsert({
    where: { key: "ownerCommissionRateBps" },
    update: { value: "2000" },
    create: { key: "ownerCommissionRateBps", value: "2000" },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED_DATABASE",
      targetType: "System",
      targetId: "seed",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
