import { z } from "zod";

import { handleRouteError, ok, readJson, requireAdmin } from "@/lib/http";
import { markItemPayroll } from "@/lib/reporting";

const schema = z.object({ paid: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const params = await context.params;
    const input = await readJson(request, schema);
    return ok({ item: await markItemPayroll({ actorId: admin.id, itemId: params.id, paid: input.paid }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

