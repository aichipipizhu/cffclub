import { z } from "zod";

import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { handleRouteError, ok, readJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const input = await readJson(request, loginSchema);
    const user = await prisma.user.findUnique({ where: { username: input.username } });

    if (!user || !user.active || !(await verifyPassword(input.password, user.passwordHash))) {
      return ok({ error: "账号或密码错误" }, { status: 401 });
    }

    await setSessionCookie(user);
    return ok({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

