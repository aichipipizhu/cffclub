import { Prisma } from "@prisma/client";
import { z } from "zod";

import { hashPassword, setSessionCookie } from "@/lib/auth";
import { handleRouteError, ok, wrapRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { parseRegistrationInput, registrationErrorMessage } from "@/lib/registration";

function handleRegisterError(error: unknown) {
  if (error instanceof z.ZodError) {
    return ok({ error: registrationErrorMessage(error) }, { status: 400 });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return ok({ error: "账号已存在，请换一个" }, { status: 409 });
  }

  return handleRouteError(error);
}

export const POST = wrapRoute(async (request: Request) => {
  const input = parseRegistrationInput(await request.json());
  const existing = await prisma.user.findUnique({
    where: { username: input.username },
    select: { id: true },
  });

  if (existing) {
    return ok({ error: "账号已存在，请换一个" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      username: input.username,
      displayName: input.displayName,
      passwordHash: await hashPassword(input.password),
      role: "PLAYER",
      active: true,
    },
  });

  await setSessionCookie(user);
  return ok(
    {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    },
    { status: 201 },
  );
}, handleRegisterError);
