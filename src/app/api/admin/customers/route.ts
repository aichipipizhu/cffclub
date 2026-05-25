import { z } from "zod";

import { ok, readJson, requireAdmin, wrapRoute } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1),
  wechat: z.string().optional(),
  note: z.string().optional(),
  ownerId: z.string().nullable().optional(),
  aliases: z.array(z.string()).default([]),
});

const patchSchema = createSchema.partial().extend({
  id: z.string().min(1),
  status: z.enum(["PENDING", "CONFIRMED"]).optional(),
  mergeToCustomerId: z.string().optional(),
});

export const GET = wrapRoute(async () => {
  await requireAdmin();
  const customers = await prisma.customer.findMany({
    include: { owner: true, aliases: true },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return ok({ customers });
});

export const POST = wrapRoute(async (request: Request) => {
  await requireAdmin();
  const input = await readJson(request, createSchema);
  const customer = await prisma.customer.create({
    data: {
      name: input.name,
      wechat: input.wechat || null,
      note: input.note || null,
      ownerId: input.ownerId || null,
      status: "CONFIRMED",
      aliases: { create: (input.aliases ?? []).filter(Boolean).map((alias) => ({ alias })) },
    },
    include: { owner: true, aliases: true },
  });
  return ok({ customer });
});

export const PATCH = wrapRoute(async (request: Request) => {
  await requireAdmin();
  const input = await readJson(request, patchSchema);

    if (input.mergeToCustomerId) {
      const targetCustomerId = input.mergeToCustomerId;
      const merged = await prisma.$transaction(async (tx) => {
        const source = await tx.customer.findUnique({
          where: { id: input.id },
          include: { aliases: true },
        });
        if (!source) {
          throw new Error("source customer missing");
        }
        await tx.order.updateMany({
          where: { customerId: input.id },
          data: { customerId: targetCustomerId },
        });
        await tx.customerAlias.createMany({
          data: [
            { customerId: targetCustomerId, alias: source.name },
            ...source.aliases.map((alias) => ({
              customerId: targetCustomerId,
              alias: alias.alias,
            })),
          ],
          skipDuplicates: true,
        });
        await tx.customer.delete({ where: { id: input.id } });
        return tx.customer.findUniqueOrThrow({
          where: { id: targetCustomerId },
          include: { owner: true, aliases: true },
        });
      });
    return ok({ customer: merged });
  }

    const customer = await prisma.customer.update({
      where: { id: input.id },
      data: {
        name: input.name,
        wechat: input.wechat,
        note: input.note,
        ownerId: input.ownerId,
        status: input.status,
        ...(input.aliases
          ? {
              aliases: {
                deleteMany: {},
                create: input.aliases.filter(Boolean).map((alias) => ({ alias })),
              },
            }
          : {}),
      },
      include: { owner: true, aliases: true },
    });
  return ok({ customer });
});
