import { clearSessionCookie } from "@/lib/auth";
import { ok, wrapRoute } from "@/lib/http";

export const POST = wrapRoute(async () => {
  await clearSessionCookie();
  return ok({ ok: true });
});
