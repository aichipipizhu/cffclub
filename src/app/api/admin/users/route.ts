import { z } from "zod";

import { hashPassword } from "@/lib/auth";
import { handleRouteError, ok, readJson, requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "PLAYER"]).default("PLAYER"),
});

const patchSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["ADMIN", "PLAYER"]).optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { displayName: "asc" }],
      select: { id: true, username: true, displayName: true, role: true, active: true, createdAt: true },
    });
    return ok({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = await readJson(request, createSchema);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
        role: input.role,
      },
      select: { id: true, username: true, displayName: true, role: true, active: true },
    });
    return ok({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const input = await readJson(request, patchSchema);
    const user = await prisma.user.update({
      where: { id: input.id },
      data: {
        displayName: input.displayName,
        role: input.role,
        active: input.active,
        ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
      },
      select: { id: true, username: true, displayName: true, role: true, active: true },
    });
    return ok({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}

