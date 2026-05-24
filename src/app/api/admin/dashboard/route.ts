import { handleRouteError, ok, parseDateRange, requireAdmin } from "@/lib/http";
import { getAdminDashboard } from "@/lib/reporting";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const range = parseDateRange(new URL(request.url));
    return ok(await getAdminDashboard(range));
  } catch (error) {
    return handleRouteError(error);
  }
}

