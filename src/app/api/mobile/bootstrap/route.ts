import { ok, requireUser, wrapRoute } from "@/lib/http";
import { getMobileBootstrap } from "@/lib/reporting";

export const GET = wrapRoute(async () => {
  const user = await requireUser();
  const data = await getMobileBootstrap(user.id);
  return ok(data);
});
