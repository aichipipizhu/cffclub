import { ok, requireUser, wrapRoute } from "@/lib/http";
import { searchMobileCustomers } from "@/lib/reporting";

export const GET = wrapRoute(async (request: Request) => {
  await requireUser();
  const query = new URL(request.url).searchParams.get("query") || "";
  return ok({ customers: await searchMobileCustomers(query) });
});
