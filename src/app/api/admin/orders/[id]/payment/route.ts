import { z } from "zod";

import { handleRouteError, ok, readJson, requireAdmin } from "@/lib/http";
import { markOrderPayment } from "@/lib/reporting";

const schema = z.object({ paid: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const params = await context.params;
    const input = await readJson(request, schema);
    return ok({ order: await markOrderPayment({ actorId: admin.id, orderId: params.id, paid: input.paid }) });
  } catch (error) {
    return handleRouteError(error);
  }
}

