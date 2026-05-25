import { z } from "zod";

import { ok, readJson, requireAdmin, wrapRoute } from "@/lib/http";
import { bpsFromPercent, getOwnerCommissionRateBps, percentFromBps, setOwnerCommissionRateBps } from "@/lib/reporting";

const schema = z.object({
  ownerCommissionPercent: z.number().min(0).max(100),
});

export const GET = wrapRoute(async () => {
  await requireAdmin();
  return ok({ ownerCommissionPercent: percentFromBps(await getOwnerCommissionRateBps()) });
});

export const POST = wrapRoute(async (request: Request) => {
  await requireAdmin();
  const input = await readJson(request, schema);
  await setOwnerCommissionRateBps(bpsFromPercent(input.ownerCommissionPercent));
  return ok({ ownerCommissionPercent: input.ownerCommissionPercent });
});
