import { z } from "zod";

import { handleRouteError, ok, readJson, requireUser } from "@/lib/http";
import { listPlayerItems, startOrderForPlayer } from "@/lib/reporting";

const startSchema = z.object({
  customerId: z.string().optional(),
  newCustomerName: z.string().optional(),
  newCustomerWechat: z.string().optional(),
  newCustomerNote: z.string().optional(),
  categoryId: z.string().min(1),
  startAt: z.string().datetime().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ items: await listPlayerItems(user.id) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await readJson(request, startSchema);
    const order = await startOrderForPlayer({
      playerId: user.id,
      ...input,
      startAt: input.startAt ? new Date(input.startAt) : undefined,
    });
    return ok({ order });
  } catch (error) {
    return handleRouteError(error);
  }
}

