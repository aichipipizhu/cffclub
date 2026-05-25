import { z } from "zod";

import { ok, readJson, requireAdmin, wrapRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { bpsFromPercent } from "@/lib/reporting";

const schema = z.object({
  playerId: z.string().min(1),
  categoryId: z.string().min(1),
  platformCommissionPercent: z.number().min(0).max(100).nullable().optional(),
});

export const GET = wrapRoute(async () => {
  await requireAdmin();
  const overrides = await prisma.playerPricingOverride.findMany({
    include: { player: true, category: true },
    orderBy: { updatedAt: "desc" },
  });
  return ok({ overrides });
});

export const POST = wrapRoute(async (request: Request) => {
  await requireAdmin();
  const input = await readJson(request, schema);
  const override = await prisma.playerPricingOverride.upsert({
    where: { playerId_categoryId: { playerId: input.playerId, categoryId: input.categoryId } },
    update: {
      platformCommissionRateBps:
        input.platformCommissionPercent === undefined || input.platformCommissionPercent === null
          ? null
          : bpsFromPercent(input.platformCommissionPercent),
    },
    create: {
      playerId: input.playerId,
      categoryId: input.categoryId,
      platformCommissionRateBps:
        input.platformCommissionPercent === undefined || input.platformCommissionPercent === null
          ? null
          : bpsFromPercent(input.platformCommissionPercent),
    },
    include: { player: true, category: true },
  });
  return ok({ override });
});
