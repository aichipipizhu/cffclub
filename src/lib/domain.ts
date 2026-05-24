export type ItemStatus = "STARTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export type PaymentStatus = "UNPAID" | "PAID";
export type PayrollStatus = "UNPAID" | "PAID";

export type CategoryPricingRule = {
  unitPriceCents: number;
  platformCommissionRateBps: number;
};

export type PlayerPricingOverride = {
  unitPriceCents?: number | null;
  platformCommissionRateBps?: number | null;
};

export type PricingInput = {
  startAt: string | Date;
  endAt: string | Date;
  unitPriceCents: number;
  platformCommissionRateBps: number;
  ownerCommissionRateBps: number;
};

export type PricingResult = {
  billableMinutes: number;
  billableHours: number;
  grossAmountCents: number;
  platformCommissionCents: number;
  playerPayoutCents: number;
  ownerCommissionCents: number;
};

export type SummaryItem = {
  status: ItemStatus;
  paymentStatus: PaymentStatus;
  payrollStatus: PayrollStatus;
  grossAmountCents: number;
  platformCommissionCents: number;
  playerPayoutCents: number;
  ownerCommissionCents: number;
};

export type ApprovedSummary = {
  approvedCount: number;
  grossAmountCents: number;
  unpaidAmountCents: number;
  platformCommissionCents: number;
  playerPayoutCents: number;
  ownerCommissionCents: number;
  unpaidPayrollCents: number;
  platformNetCents: number;
};

export type WechatReportInput = {
  orderCode: string;
  customerName: string;
  categoryName: string;
  playerName: string;
  gameId?: string | null;
  startAt: string | Date;
  endAt: string | Date;
  billableMinutes: number;
  unitPriceCents: number;
  grossAmountCents: number;
  platformCommissionCents: number;
  ownerName?: string | null;
  note?: string | null;
};

export function calculateBillableMinutes(startAt: string | Date, endAt: string | Date): number {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("INVALID_TIME");
  }

  if (end <= start) {
    throw new Error("END_BEFORE_START");
  }

  const elapsedMinutes = Math.ceil((end - start) / 60000);
  const fullBlocks = Math.floor(elapsedMinutes / 30);
  const remainder = elapsedMinutes % 30;

  let extraMinutes = 0;
  if (remainder >= 11 && remainder <= 20) {
    extraMinutes = 15;
  } else if (remainder >= 21) {
    extraMinutes = 30;
  }

  return fullBlocks * 30 + extraMinutes;
}

export function calculateOrderItemPricing(input: PricingInput): PricingResult {
  const billableMinutes = calculateBillableMinutes(input.startAt, input.endAt);
  const billableHours = billableMinutes / 60;
  const grossAmountCents = Math.round((input.unitPriceCents * billableMinutes) / 60);
  const platformCommissionCents = Math.round((grossAmountCents * input.platformCommissionRateBps) / 10000);
  const playerPayoutCents = grossAmountCents - platformCommissionCents;
  const ownerCommissionCents = Math.round((platformCommissionCents * input.ownerCommissionRateBps) / 10000);

  return {
    billableMinutes,
    billableHours,
    grossAmountCents,
    platformCommissionCents,
    playerPayoutCents,
    ownerCommissionCents,
  };
}

export function resolvePricingRule(
  category: CategoryPricingRule,
  override?: PlayerPricingOverride | null,
): CategoryPricingRule {
  return {
    unitPriceCents: override?.unitPriceCents ?? category.unitPriceCents,
    platformCommissionRateBps:
      override?.platformCommissionRateBps ?? category.platformCommissionRateBps,
  };
}

export function canPlayerEditItem(status: ItemStatus): boolean {
  return status !== "APPROVED";
}

export function summarizeApprovedItems(items: SummaryItem[]): ApprovedSummary {
  const summary: ApprovedSummary = {
    approvedCount: 0,
    grossAmountCents: 0,
    unpaidAmountCents: 0,
    platformCommissionCents: 0,
    playerPayoutCents: 0,
    ownerCommissionCents: 0,
    unpaidPayrollCents: 0,
    platformNetCents: 0,
  };

  for (const item of items) {
    if (item.status !== "APPROVED") {
      continue;
    }

    summary.approvedCount += 1;
    summary.grossAmountCents += item.grossAmountCents;
    summary.platformCommissionCents += item.platformCommissionCents;
    summary.playerPayoutCents += item.playerPayoutCents;
    summary.ownerCommissionCents += item.ownerCommissionCents;

    if (item.paymentStatus === "UNPAID") {
      summary.unpaidAmountCents += item.grossAmountCents;
    }

    if (item.payrollStatus === "UNPAID") {
      summary.unpaidPayrollCents += item.playerPayoutCents;
    }
  }

  summary.platformNetCents = summary.platformCommissionCents - summary.ownerCommissionCents;
  return summary;
}

export function centsToYuan(cents: number): string {
  if (cents % 100 === 0) {
    return String(cents / 100);
  }

  return (cents / 100).toFixed(2).replace(/\.?0+$/, "");
}

export function billableHoursLabel(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(/\.?0+$/, "");
}

export function formatTimeOfDay(input: string | Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(input));
}

export function buildWechatReportText(input: WechatReportInput): string {
  return [
    `单号：${input.orderCode}`,
    `老板：${input.customerName}`,
    `类别：${input.categoryName}`,
    `陪玩：${input.playerName}`,
    `游戏id：${input.gameId || "-"}`,
    `时长：${billableHoursLabel(input.billableMinutes)}（${formatTimeOfDay(input.startAt)}到${formatTimeOfDay(input.endAt)}）`,
    `单价：${centsToYuan(input.unitPriceCents)}`,
    `总价：${centsToYuan(input.grossAmountCents)}`,
    `抽成：${centsToYuan(input.platformCommissionCents)}`,
    `直属陪玩：${input.ownerName || "-"}`,
    `备注：${input.note || "-"}`,
  ].join("\n");
}
