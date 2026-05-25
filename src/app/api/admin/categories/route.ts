import { z } from "zod";

import { ok, readJson, requireAdmin, wrapRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { bpsFromPercent } from "@/lib/reporting";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  platformCommissionPercent: z.number().min(0).max(100),
  active: z.boolean().default(true),
});

export const GET = wrapRoute(async () => {
  await requireAdmin();
  return ok({ categories: await prisma.category.findMany({ orderBy: { name: "asc" } }) });
});

export const POST = wrapRoute(async (request: Request) => {
  await requireAdmin();
  const input = await readJson(request, schema);
  const category = await prisma.category.upsert({
    where: { id: input.id || "__new__" },
    update: {
      name: input.name,
      platformCommissionRateBps: bpsFromPercent(input.platformCommissionPercent),
      active: input.active,
    },
    create: {
      name: input.name,
      platformCommissionRateBps: bpsFromPercent(input.platformCommissionPercent),
      active: input.active,
    },
  });
  return ok({ category });
});
