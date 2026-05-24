import { z } from "zod";

import { handleRouteError, ok, readJson, requireAdmin } from "@/lib/http";
import { bpsFromPercent, getOwnerCommissionRateBps, percentFromBps, setOwnerCommissionRateBps } from "@/lib/reporting";

const schema = z.object({
  ownerCommissionPercent: z.number().min(0).max(100),
});

export async function GET() {
  try {
    await requireAdmin();
    return ok({ ownerCommissionPercent: percentFromBps(await getOwnerCommissionRateBps()) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = await readJson(request, schema);
    await setOwnerCommissionRateBps(bpsFromPercent(input.ownerCommissionPercent));
    return ok({ ownerCommissionPercent: input.ownerCommissionPercent });
  } catch (error) {
    return handleRouteError(error);
  }
}

