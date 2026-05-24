import { z } from "zod";

import { handleRouteError, ok, readJson, requireUser } from "@/lib/http";
import { joinOrderForPlayer } from "@/lib/reporting";

const joinSchema = z.object({
  startAt: z.string().datetime().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireUser();
    const params = await context.params;
    const input = await readJson(request, joinSchema);
    const item = await joinOrderForPlayer({
      playerId: user.id,
      orderCode: params.code,
      startAt: input.startAt ? new Date(input.startAt) : undefined,
    });
    return ok({ item });
  } catch (error) {
    return handleRouteError(error);
  }
}

