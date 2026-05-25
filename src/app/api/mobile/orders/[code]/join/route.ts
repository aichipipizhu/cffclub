import { handleRouteError, ok, readJson, requireUser } from "@/lib/http";
import { joinOrderSchema } from "@/lib/mobileOrderInput";
import { joinOrderForPlayer, yuanToCents } from "@/lib/reporting";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireUser();
    const params = await context.params;
    const input = await readJson(request, joinOrderSchema);
    const item = await joinOrderForPlayer({
      playerId: user.id,
      orderCode: params.code,
      unitPriceCents: yuanToCents(input.unitPriceYuan),
      startAt: input.startAt ? new Date(input.startAt) : undefined,
    });
    return ok({ item });
  } catch (error) {
    return handleRouteError(error);
  }
}
