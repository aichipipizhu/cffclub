import { handleRouteError, ok, requireUser } from "@/lib/http";
import { buildCopyTextForItem } from "@/lib/reporting";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const params = await context.params;
    const text = await buildCopyTextForItem(user.id, params.id);
    return ok({ text });
  } catch (error) {
    return handleRouteError(error);
  }
}
