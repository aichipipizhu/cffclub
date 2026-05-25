import { z } from "zod";

import { ok, readJson, requireAdmin, wrapRoute } from "@/lib/http";
import { markItemPayroll } from "@/lib/reporting";

const schema = z.object({ paid: z.boolean() });

export const PATCH = wrapRoute(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const params = await context.params;
  const input = await readJson(request, schema);
  return ok({ item: await markItemPayroll({ actorId: admin.id, itemId: params.id, paid: input.paid }) });
});
