import { z } from "zod";

import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { ok, readJson, wrapRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const POST = wrapRoute(async (request: Request) => {
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
});
