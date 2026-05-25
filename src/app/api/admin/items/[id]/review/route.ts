import { z } from "zod";

import { ok, readJson, requireAdmin, wrapRoute } from "@/lib/http";
import { reviewOrderItem, yuanToCents, bpsFromPercent } from "@/lib/reporting";

const reviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  unitPriceYuan: z.number().min(0).optional(),
  platformCommissionPercent: z.number().min(0).max(100).optional(),
  gameId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export const POST = wrapRoute(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const params = await context.params;
  const input = await readJson(request, reviewSchema);
  const item = await reviewOrderItem({
    actorId: admin.id,
    itemId: params.id,
    action: input.action,
    reason: input.reason,
    startAt: input.startAt ? new Date(input.startAt) : undefined,
    endAt: input.endAt ? new Date(input.endAt) : undefined,
    unitPriceCents: input.unitPriceYuan === undefined ? undefined : yuanToCents(input.unitPriceYuan),
    platformCommissionRateBps:
      input.platformCommissionPercent === undefined
        ? undefined
        : bpsFromPercent(input.platformCommissionPercent),
    gameId: input.gameId,
    note: input.note,
  });
  return ok({ item });
});
