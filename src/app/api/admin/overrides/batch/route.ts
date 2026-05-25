import { z } from "zod";

import { batchSavePricingOverrides } from "@/lib/config";
import { ok, readJson, requireAdmin, wrapRoute } from "@/lib/http";

const schema = z.object({
  items: z
    .array(
      z.object({
        playerId: z.string().min(1),
        categoryId: z.string().min(1),
        platformCommissionPercent: z.number().min(0).max(100).nullable(),
      }),
    )
    .max(2000),
});

export const PATCH = wrapRoute(async (request: Request) => {
  await requireAdmin();
  const input = await readJson(request, schema);
  return ok({ pricingOverrides: await batchSavePricingOverrides(input.items) });
});

