import { z } from "zod";

import { batchSaveCategories } from "@/lib/config";
import { ok, readJson, requireAdmin, wrapRoute } from "@/lib/http";

const schema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        name: z.string().min(1),
        platformCommissionPercent: z.number().min(0).max(100),
        active: z.boolean(),
      }),
    )
    .max(2000),
});

export const PATCH = wrapRoute(async (request: Request) => {
  await requireAdmin();
  const input = await readJson(request, schema);
  return ok({ categories: await batchSaveCategories(input.items) });
});

