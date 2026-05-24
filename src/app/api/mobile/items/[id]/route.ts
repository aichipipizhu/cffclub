import { z } from "zod";

import { handleRouteError, ok, readJson, requireUser } from "@/lib/http";
import { updatePlayerOrderItem } from "@/lib/reporting";

const updateSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().nullable().optional(),
  gameId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  submit: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const params = await context.params;
    const input = await readJson(request, updateSchema);
    const item = await updatePlayerOrderItem({
      playerId: user.id,
      itemId: params.id,
      startAt: input.startAt ? new Date(input.startAt) : undefined,
      endAt: input.endAt === undefined ? undefined : input.endAt ? new Date(input.endAt) : null,
      gameId: input.gameId,
      note: input.note,
      submit: input.submit,
    });
    return ok({ item });
  } catch (error) {
    return handleRouteError(error);
  }
}

