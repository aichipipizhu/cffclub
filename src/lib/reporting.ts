import type { Prisma } from "@prisma/client";

import {
  buildWechatReportText,
  calculateOrderItemPricing,
  canPlayerEditItem,
  resolvePricingRule,
  summarizeApprovedItems,
} from "@/lib/domain";
import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const OWNER_COMMISSION_RATE_KEY = "ownerCommissionRateBps";

const itemInclude = {
  player: true,
  ownerCommission: true,
  order: {
    include: {
      category: true,
      customer: {
        include: {
          owner: true,
          aliases: true,
        },
      },
    },
  },
} satisfies Prisma.OrderItemInclude;

export type OrderItemWithRelations = Prisma.OrderItemGetPayload<{ include: typeof itemInclude }>;

export type DateRange = {
  from?: Date;
  to?: Date;
};

export function centsToInputYuan(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.?0+$/, "");
}

export function yuanToCents(value: number): number {
  return Math.round(value * 100);
}

export function bpsFromPercent(value: number): number {
  return Math.round(value * 100);
}

export function percentFromBps(value: number): number {
  return value / 100;
}

export async function getOwnerCommissionRateBps(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: OWNER_COMMISSION_RATE_KEY } });
  return setting ? Number(setting.value) : 2000;
}

export async function setOwnerCommissionRateBps(rateBps: number): Promise<void> {
  await prisma.setting.upsert({
    where: { key: OWNER_COMMISSION_RATE_KEY },
    update: { value: String(rateBps) },
    create: { key: OWNER_COMMISSION_RATE_KEY, value: String(rateBps) },
  });
}

async function resolvePricingForPlayer(playerId: string, categoryId: string) {
  const [category, override] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { id: categoryId } }),
    prisma.playerPricingOverride.findUnique({
      where: { playerId_categoryId: { playerId, categoryId } },
    }),
  ]);

  return {
    category,
    rule: resolvePricingRule(category, override),
  };
}

function shanghaiDatePrefix(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}${map.month}${map.day}`;
}

async function nextOrderCode(): Promise<string> {
  const prefix = shanghaiDatePrefix();
  const count = await prisma.order.count({ where: { code: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

async function createUniqueOrderCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = await nextOrderCode();
    const exists = await prisma.order.findUnique({ where: { code }, select: { id: true } });
    if (!exists) {
      return code;
    }
  }

  return `${shanghaiDatePrefix()}${Date.now().toString().slice(-6)}`;
}

async function resolveCustomer(input: {
  customerId?: string;
  newCustomerName?: string;
  newCustomerWechat?: string;
  newCustomerNote?: string;
  currentPlayerId: string;
}) {
  if (input.customerId) {
    return prisma.customer.findUniqueOrThrow({ where: { id: input.customerId } });
  }

  if (!input.newCustomerName?.trim()) {
    throw new HttpError(400, "请选择老板或填写新老板");
  }

  return prisma.customer.create({
    data: {
      name: input.newCustomerName.trim(),
      wechat: input.newCustomerWechat?.trim() || null,
      note: input.newCustomerNote?.trim() || null,
      ownerId: input.currentPlayerId,
      status: "PENDING",
    },
  });
}

export async function getMobileBootstrap(playerId: string) {
  const [customers, categories, activeItems] = await Promise.all([
    prisma.customer.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: { owner: true, aliases: true },
    }),
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.orderItem.findMany({
      where: {
        playerId,
        status: { in: ["STARTED", "PENDING_REVIEW", "REJECTED"] },
      },
      include: itemInclude,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return { customers, categories, activeItems };
}

export async function listPlayerItems(playerId: string) {
  return prisma.orderItem.findMany({
    where: { playerId },
    include: itemInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function startOrderForPlayer(input: {
  playerId: string;
  customerId?: string;
  newCustomerName?: string;
  newCustomerWechat?: string;
  newCustomerNote?: string;
  categoryId: string;
  startAt?: Date;
}) {
  const customer = await resolveCustomer({ ...input, currentPlayerId: input.playerId });
  const { rule } = await resolvePricingForPlayer(input.playerId, input.categoryId);
  const code = await createUniqueOrderCode();

  return prisma.order.create({
    data: {
      code,
      customerId: customer.id,
      categoryId: input.categoryId,
      reportedById: input.playerId,
      items: {
        create: {
          playerId: input.playerId,
          startAt: input.startAt ?? new Date(),
          unitPriceCents: rule.unitPriceCents,
          platformCommissionRateBps: rule.platformCommissionRateBps,
          ownerCommissionRateBps: await getOwnerCommissionRateBps(),
          status: "STARTED",
        },
      },
    },
    include: {
      customer: { include: { owner: true } },
      category: true,
      items: { include: itemInclude },
    },
  });
}

export async function joinOrderForPlayer(input: { playerId: string; orderCode: string; startAt?: Date }) {
  const order = await prisma.order.findUnique({
    where: { code: input.orderCode },
    include: { category: true },
  });

  if (!order) {
    throw new HttpError(404, "单号不存在");
  }

  const { rule } = await resolvePricingForPlayer(input.playerId, order.categoryId);

  return prisma.orderItem.create({
    data: {
      orderId: order.id,
      playerId: input.playerId,
      startAt: input.startAt ?? new Date(),
      unitPriceCents: rule.unitPriceCents,
      platformCommissionRateBps: rule.platformCommissionRateBps,
      ownerCommissionRateBps: await getOwnerCommissionRateBps(),
      status: "STARTED",
    },
    include: itemInclude,
  });
}

export async function updatePlayerOrderItem(input: {
  playerId: string;
  itemId: string;
  startAt?: Date;
  endAt?: Date | null;
  gameId?: string | null;
  note?: string | null;
  submit?: boolean;
}) {
  const item = await prisma.orderItem.findUnique({
    where: { id: input.itemId },
    include: { order: true },
  });

  if (!item || item.playerId !== input.playerId) {
    throw new HttpError(404, "报单不存在");
  }

  if (!canPlayerEditItem(item.status)) {
    throw new HttpError(409, "该报单已审核，不能再修改");
  }

  const startAt = input.startAt ?? item.startAt;
  const endAt = input.endAt === undefined ? item.endAt : input.endAt;
  const data: Prisma.OrderItemUpdateInput = {
    startAt,
    endAt,
    gameId: input.gameId === undefined ? item.gameId : input.gameId,
    note: input.note === undefined ? item.note : input.note,
  };

  if (input.submit) {
    if (!endAt) {
      throw new HttpError(400, "结束报单需要填写结束时间");
    }
    const { rule } = await resolvePricingForPlayer(input.playerId, item.order.categoryId);
    const ownerCommissionRateBps = await getOwnerCommissionRateBps();
    const { billableHours: _billableHours, ...pricing } = calculateOrderItemPricing({
      startAt,
      endAt,
      unitPriceCents: rule.unitPriceCents,
      platformCommissionRateBps: rule.platformCommissionRateBps,
      ownerCommissionRateBps,
    });

    Object.assign(data, {
      ...pricing,
      unitPriceCents: rule.unitPriceCents,
      platformCommissionRateBps: rule.platformCommissionRateBps,
      ownerCommissionRateBps,
      status: "PENDING_REVIEW",
      submittedAt: new Date(),
      rejectedReason: null,
    });
  }

  return prisma.orderItem.update({
    where: { id: input.itemId },
    data,
    include: itemInclude,
  });
}

export async function buildCopyTextForItem(playerId: string, itemId: string) {
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: itemInclude,
  });

  if (!item || item.playerId !== playerId) {
    throw new HttpError(404, "报单不存在");
  }

  if (!item.endAt) {
    throw new HttpError(400, "结束后才能生成报单文案");
  }

  return buildWechatReportText({
    orderCode: item.order.code,
    customerName: item.order.customer.name,
    categoryName: item.order.category.name,
    playerName: item.player.displayName,
    gameId: item.gameId,
    startAt: item.startAt,
    endAt: item.endAt,
    billableMinutes: item.billableMinutes,
    unitPriceCents: item.unitPriceCents,
    grossAmountCents: item.grossAmountCents,
    platformCommissionCents: item.platformCommissionCents,
    ownerName: item.order.customer.owner?.displayName,
    note: item.note || (item.order.paymentStatus === "PAID" ? "已结" : "未结"),
  });
}

export async function reviewOrderItem(input: {
  actorId: string;
  itemId: string;
  action: "APPROVE" | "REJECT";
  reason?: string;
  startAt?: Date;
  endAt?: Date;
  unitPriceCents?: number;
  platformCommissionRateBps?: number;
  gameId?: string | null;
  note?: string | null;
}) {
  const item = await prisma.orderItem.findUnique({
    where: { id: input.itemId },
    include: itemInclude,
  });

  if (!item) {
    throw new HttpError(404, "报单不存在");
  }

  if (input.action === "REJECT") {
    return prisma.orderItem.update({
      where: { id: input.itemId },
      data: {
        status: "REJECTED",
        rejectedReason: input.reason?.trim() || "管理员驳回",
        reviewedById: input.actorId,
        reviewedAt: new Date(),
      },
      include: itemInclude,
    });
  }

  const startAt = input.startAt ?? item.startAt;
  const endAt = input.endAt ?? item.endAt;
  if (!endAt) {
    throw new HttpError(400, "审核通过前需要结束时间");
  }

  const unitPriceCents = input.unitPriceCents ?? item.unitPriceCents;
  const platformCommissionRateBps =
    input.platformCommissionRateBps ?? item.platformCommissionRateBps;
  const ownerCommissionRateBps = await getOwnerCommissionRateBps();
  const { billableHours: _billableHours, ...pricing } = calculateOrderItemPricing({
    startAt,
    endAt,
    unitPriceCents,
    platformCommissionRateBps,
    ownerCommissionRateBps,
  });

  return prisma.$transaction(async (tx) => {
    const approved = await tx.orderItem.update({
      where: { id: input.itemId },
      data: {
        startAt,
        endAt,
        gameId: input.gameId === undefined ? item.gameId : input.gameId,
        note: input.note === undefined ? item.note : input.note,
        ...pricing,
        unitPriceCents,
        platformCommissionRateBps,
        ownerCommissionRateBps,
        status: "APPROVED",
        rejectedReason: null,
        reviewedById: input.actorId,
        reviewedAt: new Date(),
      },
      include: itemInclude,
    });

    const ownerId = approved.order.customer.ownerId;
    if (ownerId && approved.ownerCommissionCents > 0) {
      await tx.ownerCommission.upsert({
        where: { orderItemId: approved.id },
        update: {
          ownerId,
          amountCents: approved.ownerCommissionCents,
          rateBps: ownerCommissionRateBps,
        },
        create: {
          orderItemId: approved.id,
          ownerId,
          amountCents: approved.ownerCommissionCents,
          rateBps: ownerCommissionRateBps,
        },
      });
    } else {
      await tx.ownerCommission.deleteMany({ where: { orderItemId: approved.id } });
    }

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "APPROVE_ORDER_ITEM",
        targetType: "OrderItem",
        targetId: approved.id,
        metadata: { orderCode: approved.order.code },
      },
    });

    return approved;
  });
}

export async function markOrderPayment(input: { actorId: string; orderId: string; paid: boolean }) {
  const order = await prisma.order.update({
    where: { id: input.orderId },
    data: {
      paymentStatus: input.paid ? "PAID" : "UNPAID",
      paidAt: input.paid ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.paid ? "MARK_ORDER_PAID" : "MARK_ORDER_UNPAID",
      targetType: "Order",
      targetId: input.orderId,
    },
  });

  return order;
}

export async function markItemPayroll(input: { actorId: string; itemId: string; paid: boolean }) {
  const item = await prisma.orderItem.update({
    where: { id: input.itemId },
    data: {
      payrollStatus: input.paid ? "PAID" : "UNPAID",
      payrollPaidAt: input.paid ? new Date() : null,
    },
    include: itemInclude,
  });

  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.paid ? "MARK_PAYROLL_PAID" : "MARK_PAYROLL_UNPAID",
      targetType: "OrderItem",
      targetId: input.itemId,
    },
  });

  return item;
}

function rangeWhere(range: DateRange): Prisma.OrderItemWhereInput {
  return {
    ...(range.from || range.to
      ? {
          startAt: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        }
      : {}),
  };
}

export async function listAdminItems(range: DateRange = {}) {
  return prisma.orderItem.findMany({
    where: rangeWhere(range),
    include: itemInclude,
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
}

export async function getAdminDashboard(range: DateRange = {}) {
  const [items, customers, users, categories, settings] = await Promise.all([
    listAdminItems(range),
    prisma.customer.findMany({ include: { owner: true, aliases: true }, orderBy: { updatedAt: "desc" } }),
    prisma.user.findMany({ orderBy: [{ role: "asc" }, { displayName: "asc" }] }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.setting.findMany(),
  ]);

  const totals = summarizeApprovedItems(
    items.map((item) => ({
      status: item.status,
      paymentStatus: item.order.paymentStatus,
      payrollStatus: item.payrollStatus,
      grossAmountCents: item.grossAmountCents,
      platformCommissionCents: item.platformCommissionCents,
      playerPayoutCents: item.playerPayoutCents,
      ownerCommissionCents: item.ownerCommissionCents,
    })),
  );

  const payrollByPlayer = new Map<string, { playerId: string; playerName: string; amountCents: number; unpaidCents: number; count: number }>();
  const spendByCustomer = new Map<string, { customerId: string; customerName: string; amountCents: number; unpaidCents: number; count: number }>();
  const ownerCommissionByPlayer = new Map<string, { playerId: string; playerName: string; amountCents: number; count: number }>();

  for (const item of items) {
    if (item.status !== "APPROVED") {
      continue;
    }

    const payroll = payrollByPlayer.get(item.playerId) ?? {
      playerId: item.playerId,
      playerName: item.player.displayName,
      amountCents: 0,
      unpaidCents: 0,
      count: 0,
    };
    payroll.amountCents += item.playerPayoutCents;
    payroll.unpaidCents += item.payrollStatus === "UNPAID" ? item.playerPayoutCents : 0;
    payroll.count += 1;
    payrollByPlayer.set(item.playerId, payroll);

    const spend = spendByCustomer.get(item.order.customerId) ?? {
      customerId: item.order.customerId,
      customerName: item.order.customer.name,
      amountCents: 0,
      unpaidCents: 0,
      count: 0,
    };
    spend.amountCents += item.grossAmountCents;
    spend.unpaidCents += item.order.paymentStatus === "UNPAID" ? item.grossAmountCents : 0;
    spend.count += 1;
    spendByCustomer.set(item.order.customerId, spend);

    const owner = item.order.customer.owner;
    if (owner && item.ownerCommissionCents > 0) {
      const ownerSummary = ownerCommissionByPlayer.get(owner.id) ?? {
        playerId: owner.id,
        playerName: owner.displayName,
        amountCents: 0,
        count: 0,
      };
      ownerSummary.amountCents += item.ownerCommissionCents;
      ownerSummary.count += 1;
      ownerCommissionByPlayer.set(owner.id, ownerSummary);
    }
  }

  return {
    totals,
    items,
    customers,
    users,
    categories,
    settings,
    payrollByPlayer: [...payrollByPlayer.values()].sort((a, b) => b.amountCents - a.amountCents),
    spendByCustomer: [...spendByCustomer.values()].sort((a, b) => b.amountCents - a.amountCents),
    ownerCommissionByPlayer: [...ownerCommissionByPlayer.values()].sort(
      (a, b) => b.amountCents - a.amountCents,
    ),
  };
}

export async function createAudit(actorId: string, action: string, targetType: string, targetId: string, metadata?: unknown) {
  return prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      metadata: metadata === undefined ? undefined : (metadata as Prisma.InputJsonValue),
    },
  });
}
