import { ok, parseDateRange, requireAdmin, wrapRoute } from "@/lib/http";
import { getAdminDashboard } from "@/lib/reporting";

export const GET = wrapRoute(async (request: Request) => {
  await requireAdmin();
  const range = parseDateRange(new URL(request.url));
  return ok(await getAdminDashboard(range));
});
