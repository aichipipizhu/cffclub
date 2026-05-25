import { ok, requireUser, wrapRoute } from "@/lib/http";
import { buildCopyTextForItem } from "@/lib/reporting";

export const GET = wrapRoute(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const params = await context.params;
  const text = await buildCopyTextForItem(user.id, params.id);
  return ok({ text });
});
