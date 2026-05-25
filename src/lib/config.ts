import type { PrismaClient } from "@prisma/client";

import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { bpsFromPercent } from "@/lib/reporting";

const MAX_BATCH_ITEMS = 2000;

type ConfigDb = PrismaClient;

export type OverrideBatchItem = {
  playerId: string;
  categoryId: string;
  platformCommissionPercent: number | null;
};

export type CategoryBatchItem = {
  id?: string;
  name: string;
  platformCommissionPercent: number;
  active: boolean;
};

export type CustomerBatchItem = {
  id?: string;
  name: string;
  wechat?: string | null;
  note?: string | null;
  ownerId?: string | null;
  status?: "PENDING" | "CONFIRMED";
  aliases?: string[];
};

function assertBatchSize(items: unknown[]) {
  if (items.length > MAX_BATCH_ITEMS) {
    throw new HttpError(400, `一次最多提交 ${MAX_BATCH_ITEMS} 条修改`);
  }
}

function normalizeAliases(aliases: string[] = []) {
  return Array.from(new Set(aliases.map((alias) => alias.trim()).filter(Boolean)));
}

export async function batchSavePricingOverrides(items: OverrideBatchItem[], db: ConfigDb = prisma) {
  assertBatchSize(items);
  const playerIds = Array.from(new Set(items.map((item) => item.playerId)));
  const categoryIds = Array.from(new Set(items.map((item) => item.categoryId)));

  const [players, categories] = await Promise.all([
    db.user.findMany({ where: { id: { in: playerIds }, role: "PLAYER" }, select: { id: true } }),
    db.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true } }),
  ]);

  if (players.length !== playerIds.length || categories.length !== categoryIds.length) {
    throw new HttpError(400, "员工或品类不存在");
  }

  return db.$transaction(async (tx) => {
    for (const item of items) {
      if (item.platformCommissionPercent === null) {
        await tx.playerPricingOverride.deleteMany({
          where: { playerId: item.playerId, categoryId: item.categoryId },
        });
        continue;
      }

      await tx.playerPricingOverride.upsert({
        where: { playerId_categoryId: { playerId: item.playerId, categoryId: item.categoryId } },
        update: { platformCommissionRateBps: bpsFromPercent(item.platformCommissionPercent) },
        create: {
          playerId: item.playerId,
          categoryId: item.categoryId,
          platformCommissionRateBps: bpsFromPercent(item.platformCommissionPercent),
        },
      });
    }

    return tx.playerPricingOverride.findMany({
      orderBy: { updatedAt: "desc" },
      select: { playerId: true, categoryId: true, platformCommissionRateBps: true },
    });
  });
}

export async function batchSaveCategories(items: CategoryBatchItem[], db: ConfigDb = prisma) {
  assertBatchSize(items);

  return db.$transaction(async (tx) => {
    for (const item of items) {
      const data = {
        name: item.name.trim(),
        platformCommissionRateBps: bpsFromPercent(item.platformCommissionPercent),
        active: item.active,
      };

      if (item.id) {
        await tx.category.update({ where: { id: item.id }, data });
      } else {
        await tx.category.create({ data });
      }
    }

    return tx.category.findMany({ orderBy: { name: "asc" } });
  });
}

export async function batchSaveCustomers(items: CustomerBatchItem[], db: ConfigDb = prisma) {
  assertBatchSize(items);

  return db.$transaction(async (tx) => {
    for (const item of items) {
      const aliases = item.aliases === undefined ? undefined : normalizeAliases(item.aliases);
      const data = {
        name: item.name.trim(),
        wechat: item.wechat,
        note: item.note,
        ownerId: item.ownerId,
        status: item.status,
        ...(aliases
          ? {
              aliases: {
                deleteMany: {},
                create: aliases.map((alias) => ({ alias })),
              },
            }
          : {}),
      };

      if (item.id) {
        await tx.customer.update({
          where: { id: item.id },
          data,
        });
      } else {
        await tx.customer.create({
          data: {
            ...data,
            status: item.status ?? "CONFIRMED",
          },
        });
      }
    }

    return tx.customer.findMany({
      include: { owner: true, aliases: true },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
  });
}

