import { Prisma } from "@prisma/client";

import {
  buildWechatReportText,
  calculateOrderItemSettlement,
  centsToYuan,
  canPlayerEditItem,
  formatOrderCode,
  normalizeOrderCodeInput,
  resolveCommissionRule,
} from "@/lib/domain";
import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const OWNER_COMMISSION_RATE_KEY = "ownerCommissionRateBps";
const ORDER_SEQUENCE_KEY_PREFIX = "orderCodeSequence:";
const ADMIN_ITEM_LIMIT = 500;

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

type SummaryRow = {
  playerId?: string;
  playerName?: string;
  customerId?: string;
  customerName?: string;
  amountCents: number;
  unpaidCents: number;
  count: number;
};

export function centsToInputYuan(cents: number): string {
  return centsToYuan(cents);
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

async function resolveCommissionForPlayer(playerId: string, categoryId: string) {
  const [category, override] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { id: categoryId } }),
    prisma.playerPricingOverride.findUnique({
      where: { playerId_categoryId: { playerId, categoryId } },
    }),
  ]);

  return {
    category,
    rule: resolveCommissionRule(category, override),
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

async function createUniqueOrderCode(): Promise<string> {
  const prefix = shanghaiDatePrefix();
  const key = `${ORDER_SEQUENCE_KEY_PREFIX}${prefix}`;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO \`Setting\` (\`key\`, \`value\`, \`updatedAt\`)
      SELECT ${key}, LAST_INSERT_ID(COALESCE(MAX(CAST(SUBSTRING(\`code\`, 9) AS UNSIGNED)), 0) + 1), NOW()
      FROM \`Order\`
      WHERE \`code\` LIKE ${`${prefix}%`}
      ON DUPLICATE KEY UPDATE
        \`value\` = LAST_INSERT_ID(CAST(\`value\` AS UNSIGNED) + 1),
        \`updatedAt\` = NOW()
    `;
    const rows = await tx.$queryRaw<Array<{ sequence: bigint | number }>>`
      SELECT LAST_INSERT_ID() AS sequence
    `;
    const sequence = Number(rows[0]?.sequence);
    if (!Number.isSafeInteger(sequence) || sequence <= 0) {
      throw new Error("INVALID_ORDER_SEQUENCE");
    }
    return formatOrderCode(prefix, sequence);
  });
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
    searchMobileCustomers(),
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

export async function searchMobileCustomers(query = "") {
  const keyword = query.trim();
  return prisma.customer.findMany({
    where: keyword
      ? {
          OR: [
            { name: { contains: keyword } },
            { wechat: { contains: keyword } },
            { aliases: { some: { alias: { contains: keyword } } } },
          ],
        }
      : undefined,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: { owner: true, aliases: true },
    take: keyword ? 50 : 100,
  });
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
  unitPriceCents: number;
  startAt?: Date;
}) {
  const customer = await resolveCustomer({ ...input, currentPlayerId: input.playerId });
  const { rule } = await resolveCommissionForPlayer(input.playerId, input.categoryId);
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
          unitPriceCents: input.unitPriceCents,
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

export async function joinOrderForPlayer(input: {
  playerId: string;
  orderCode: string;
  unitPriceCents: number;
  startAt?: Date;
}) {
  const orderCode = normalizeOrderCodeInput(input.orderCode);
  const order =
    (await prisma.order.findUnique({
      where: { code: orderCode },
      include: { category: true },
    })) ??
    (await prisma.order.findFirst({
      where: { code: { endsWith: orderCode } },
      orderBy: { createdAt: "desc" },
      include: { category: true },
    }));

  if (!order) {
    throw new HttpError(404, "单号不存在");
  }

  const { rule } = await resolveCommissionForPlayer(input.playerId, order.categoryId);

  return prisma.orderItem.create({
    data: {
      orderId: order.id,
      playerId: input.playerId,
      startAt: input.startAt ?? new Date(),
      unitPriceCents: input.unitPriceCents,
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
    const ownerCommissionRateBps = await getOwnerCommissionRateBps();
    const pricing = calculateOrderItemSettlement({
      startAt,
      endAt,
      unitPriceCents: item.unitPriceCents,
      platformCommissionRateBps: item.platformCommissionRateBps,
      ownerCommissionRateBps,
    });

    Object.assign(data, {
      ...pricing,
      unitPriceCents: item.unitPriceCents,
      platformCommissionRateBps: item.platformCommissionRateBps,
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
  const pricing = calculateOrderItemSettlement({
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
    take: ADMIN_ITEM_LIMIT + 1,
  });
}

function cents(value?: number | bigint | null): number {
  return Number(value ?? 0);
}

async function summarizeAdminTotals(range: DateRange) {
  const approvedWhere = { ...rangeWhere(range), status: "APPROVED" as const };
  const [approved, unpaid, unpaidPayroll] = await Promise.all([
    prisma.orderItem.aggregate({
      where: approvedWhere,
      _count: { _all: true },
      _sum: {
        grossAmountCents: true,
        platformCommissionCents: true,
        playerPayoutCents: true,
        ownerCommissionCents: true,
      },
    }),
    prisma.orderItem.aggregate({
      where: { ...approvedWhere, order: { paymentStatus: "UNPAID" } },
      _sum: { grossAmountCents: true },
    }),
    prisma.orderItem.aggregate({
      where: { ...approvedWhere, payrollStatus: "UNPAID" },
      _sum: { playerPayoutCents: true },
    }),
  ]);

  const platformCommissionCents = cents(approved._sum.platformCommissionCents);
  const ownerCommissionCents = cents(approved._sum.ownerCommissionCents);
  return {
    approvedCount: approved._count._all,
    grossAmountCents: cents(approved._sum.grossAmountCents),
    unpaidAmountCents: cents(unpaid._sum.grossAmountCents),
    platformCommissionCents,
    playerPayoutCents: cents(approved._sum.playerPayoutCents),
    ownerCommissionCents,
    unpaidPayrollCents: cents(unpaidPayroll._sum.playerPayoutCents),
    platformNetCents: platformCommissionCents - ownerCommissionCents,
  };
}

async function summarizePayrollByPlayer(range: DateRange, usersById: Map<string, { displayName: string }>): Promise<SummaryRow[]> {
  const approvedWhere = { ...rangeWhere(range), status: "APPROVED" as const };
  const [amounts, unpaidAmounts] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["playerId"],
      where: approvedWhere,
      _count: { _all: true },
      _sum: { playerPayoutCents: true },
    }),
    prisma.orderItem.groupBy({
      by: ["playerId"],
      where: { ...approvedWhere, payrollStatus: "UNPAID" },
      _sum: { playerPayoutCents: true },
    }),
  ]);
  const unpaidByPlayer = new Map(unpaidAmounts.map((row) => [row.playerId, cents(row._sum.playerPayoutCents)]));

  return amounts
    .map((row) => ({
      playerId: row.playerId,
      playerName: usersById.get(row.playerId)?.displayName ?? "未知陪玩",
      amountCents: cents(row._sum.playerPayoutCents),
      unpaidCents: unpaidByPlayer.get(row.playerId) ?? 0,
      count: row._count._all,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

function adminRangeSql(range: DateRange) {
  return Prisma.sql`
    ${range.from ? Prisma.sql`AND oi.\`startAt\` >= ${range.from}` : Prisma.empty}
    ${range.to ? Prisma.sql`AND oi.\`startAt\` <= ${range.to}` : Prisma.empty}
  `;
}

async function summarizeSpendByCustomer(range: DateRange): Promise<SummaryRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      customerId: string;
      customerName: string;
      amountCents: bigint | number;
      unpaidCents: bigint | number;
      count: bigint | number;
    }>
  >(Prisma.sql`
    SELECT
      o.\`customerId\` AS customerId,
      c.\`name\` AS customerName,
      SUM(oi.\`grossAmountCents\`) AS amountCents,
      SUM(CASE WHEN o.\`paymentStatus\` = 'UNPAID' THEN oi.\`grossAmountCents\` ELSE 0 END) AS unpaidCents,
      COUNT(*) AS count
    FROM \`OrderItem\` oi
    INNER JOIN \`Order\` o ON o.\`id\` = oi.\`orderId\`
    INNER JOIN \`Customer\` c ON c.\`id\` = o.\`customerId\`
    WHERE oi.\`status\` = 'APPROVED'
    ${adminRangeSql(range)}
    GROUP BY o.\`customerId\`, c.\`name\`
    ORDER BY amountCents DESC
  `);

  return rows.map((row) => ({
    customerId: row.customerId,
    customerName: row.customerName,
    amountCents: cents(row.amountCents),
    unpaidCents: cents(row.unpaidCents),
    count: cents(row.count),
  }));
}

async function summarizeOwnerCommissionByPlayer(range: DateRange, usersById: Map<string, { displayName: string }>): Promise<SummaryRow[]> {
  const rows = await prisma.ownerCommission.groupBy({
    by: ["ownerId"],
    where: { orderItem: { ...rangeWhere(range), status: "APPROVED" } },
    _count: { _all: true },
    _sum: { amountCents: true },
  });

  return rows
    .map((row) => ({
      playerId: row.ownerId,
      playerName: usersById.get(row.ownerId)?.displayName ?? "未知归属人",
      amountCents: cents(row._sum.amountCents),
      unpaidCents: 0,
      count: row._count._all,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

export async function getAdminDashboard(range: DateRange = {}) {
  const [rawItems, customers, users, categories, pricingOverrides, settings, totals, spendByCustomer] = await Promise.all([
    listAdminItems(range),
    prisma.customer.findMany({ include: { owner: true, aliases: true }, orderBy: { updatedAt: "desc" } }),
    prisma.user.findMany({ orderBy: [{ role: "asc" }, { displayName: "asc" }] }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.playerPricingOverride.findMany({
      orderBy: { updatedAt: "desc" },
      select: { playerId: true, categoryId: true, platformCommissionRateBps: true },
    }),
    prisma.setting.findMany(),
    summarizeAdminTotals(range),
    summarizeSpendByCustomer(range),
  ]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const [payrollByPlayer, ownerCommissionByPlayer] = await Promise.all([
    summarizePayrollByPlayer(range, usersById),
    summarizeOwnerCommissionByPlayer(range, usersById),
  ]);

  const hasMoreItems = rawItems.length > ADMIN_ITEM_LIMIT;
  const items = rawItems.slice(0, ADMIN_ITEM_LIMIT);

  return {
    totals,
    items,
    itemPage: {
      limit: ADMIN_ITEM_LIMIT,
      hasMore: hasMoreItems,
    },
    customers,
    users,
    categories,
    pricingOverrides,
    settings,
    payrollByPlayer,
    spendByCustomer,
    ownerCommissionByPlayer,
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
