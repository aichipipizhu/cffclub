import { handleRouteError, ok, requireUser } from "@/lib/http";
import { getMobileBootstrap } from "@/lib/reporting";

export async function GET() {
  try {
    const user = await requireUser();
    const data = await getMobileBootstrap(user.id);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

