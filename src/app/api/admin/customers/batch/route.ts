import { z } from "zod";

import { batchSaveCustomers } from "@/lib/config";
import { ok, readJson, requireAdmin, wrapRoute } from "@/lib/http";

const schema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        name: z.string().min(1),
        wechat: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
        ownerId: z.string().nullable().optional(),
        status: z.enum(["PENDING", "CONFIRMED"]).optional(),
        aliases: z.array(z.string()).optional(),
      }),
    )
    .max(2000),
});

export const PATCH = wrapRoute(async (request: Request) => {
  await requireAdmin();
  const input = await readJson(request, schema);
  return ok({ customers: await batchSaveCustomers(input.items) });
});

