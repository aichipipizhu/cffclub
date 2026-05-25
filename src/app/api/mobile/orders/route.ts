import { handleRouteError, ok, readJson, requireUser } from "@/lib/http";
import { startOrderSchema } from "@/lib/mobileOrderInput";
import { listPlayerItems, startOrderForPlayer, yuanToCents } from "@/lib/reporting";

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
    const input = await readJson(request, startOrderSchema);
    const order = await startOrderForPlayer({
      playerId: user.id,
      ...input,
      unitPriceCents: yuanToCents(input.unitPriceYuan),
      startAt: input.startAt ? new Date(input.startAt) : undefined,
    });
    return ok({ order });
  } catch (error) {
    return handleRouteError(error);
  }
}
