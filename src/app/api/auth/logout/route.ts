import { clearSessionCookie } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http";

export async function POST() {
  try {
    await clearSessionCookie();
    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

