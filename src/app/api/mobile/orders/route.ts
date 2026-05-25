import { ok, readJson, requireUser, wrapRoute } from "@/lib/http";
import { startOrderSchema } from "@/lib/mobileOrderInput";
import { listPlayerItems, startOrderForPlayer, yuanToCents } from "@/lib/reporting";

export const GET = wrapRoute(async () => {
  const user = await requireUser();
  return ok({ items: await listPlayerItems(user.id) });
});

export const POST = wrapRoute(async (request: Request) => {
  const user = await requireUser();
  const input = await readJson(request, startOrderSchema);
  const order = await startOrderForPlayer({
    playerId: user.id,
    ...input,
    unitPriceCents: yuanToCents(input.unitPriceYuan),
    startAt: input.startAt ? new Date(input.startAt) : undefined,
  });
  return ok({ order });
});
