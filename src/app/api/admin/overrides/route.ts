import { z } from "zod";

import { handleRouteError, ok, readJson, requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { bpsFromPercent, yuanToCents } from "@/lib/reporting";

const schema = z.object({
  playerId: z.string().min(1),
  categoryId: z.string().min(1),
  unitPriceYuan: z.number().min(0).nullable().optional(),
  platformCommissionPercent: z.number().min(0).max(100).nullable().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const overrides = await prisma.playerPricingOverride.findMany({
      include: { player: true, category: true },
      orderBy: { updatedAt: "desc" },
    });
    return ok({ overrides });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = await readJson(request, schema);
    const override = await prisma.playerPricingOverride.upsert({
      where: { playerId_categoryId: { playerId: input.playerId, categoryId: input.categoryId } },
      update: {
        unitPriceCents:
          input.unitPriceYuan === undefined || input.unitPriceYuan === null
            ? null
            : yuanToCents(input.unitPriceYuan),
        platformCommissionRateBps:
          input.platformCommissionPercent === undefined || input.platformCommissionPercent === null
            ? null
            : bpsFromPercent(input.platformCommissionPercent),
      },
      create: {
        playerId: input.playerId,
        categoryId: input.categoryId,
        unitPriceCents:
          input.unitPriceYuan === undefined || input.unitPriceYuan === null
            ? null
            : yuanToCents(input.unitPriceYuan),
        platformCommissionRateBps:
          input.platformCommissionPercent === undefined || input.platformCommissionPercent === null
            ? null
            : bpsFromPercent(input.platformCommissionPercent),
      },
      include: { player: true, category: true },
    });
    return ok({ override });
  } catch (error) {
    return handleRouteError(error);
  }
}

