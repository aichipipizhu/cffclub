import { getCurrentUser } from "@/lib/auth";
import { ok, wrapRoute } from "@/lib/http";

export const GET = wrapRoute(async () => {
  const user = await getCurrentUser();
  return ok({ user });
});
