import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWechatReportText,
  calculateBillableMinutes,
  calculateOrderItemPricing,
  canPlayerEditItem,
  resolvePricingRule,
  summarizeApprovedItems,
} from "../src/lib/domain.ts";

test("calculates billable duration with 30-minute blocks and remainder thresholds", () => {
  assert.equal(calculateBillableMinutes("2026-05-23T10:00:00+08:00", "2026-05-23T10:10:00+08:00"), 0);
  assert.equal(calculateBillableMinutes("2026-05-23T10:00:00+08:00", "2026-05-23T10:11:00+08:00"), 15);
  assert.equal(calculateBillableMinutes("2026-05-23T10:00:00+08:00", "2026-05-23T10:20:00+08:00"), 15);
  assert.equal(calculateBillableMinutes("2026-05-23T10:00:00+08:00", "2026-05-23T10:21:00+08:00"), 30);
  assert.equal(calculateBillableMinutes("2026-05-23T10:00:00+08:00", "2026-05-23T10:29:00+08:00"), 30);
  assert.equal(calculateBillableMinutes("2026-05-23T11:47:00+08:00", "2026-05-23T14:29:00+08:00"), 165);
});

test("calculates gross amount, platform commission, player payout, and owner commission", () => {
  const pricing = calculateOrderItemPricing({
    startAt: "2026-05-23T11:47:00+08:00",
    endAt: "2026-05-23T14:29:00+08:00",
    unitPriceCents: 4000,
    platformCommissionRateBps: 1000,
    ownerCommissionRateBps: 2000,
  });

  assert.deepEqual(pricing, {
    billableMinutes: 165,
    billableHours: 2.75,
    grossAmountCents: 11000,
    platformCommissionCents: 1100,
    playerPayoutCents: 9900,
    ownerCommissionCents: 220,
  });
});

test("player-specific pricing overrides category defaults only where configured", () => {
  const rule = resolvePricingRule(
    { unitPriceCents: 4000, platformCommissionRateBps: 1000 },
    { unitPriceCents: 4500 },
  );

  assert.deepEqual(rule, {
    unitPriceCents: 4500,
    platformCommissionRateBps: 1000,
  });
});

test("players can edit before approval but not after approval", () => {
  assert.equal(canPlayerEditItem("STARTED"), true);
  assert.equal(canPlayerEditItem("PENDING_REVIEW"), true);
  assert.equal(canPlayerEditItem("REJECTED"), true);
  assert.equal(canPlayerEditItem("APPROVED"), false);
});

test("summarizes only approved items for dashboard totals", () => {
  const summary = summarizeApprovedItems([
    {
      status: "APPROVED",
      paymentStatus: "UNPAID",
      payrollStatus: "UNPAID",
      grossAmountCents: 11000,
      platformCommissionCents: 1100,
      playerPayoutCents: 9900,
      ownerCommissionCents: 220,
    },
    {
      status: "PENDING_REVIEW",
      paymentStatus: "UNPAID",
      payrollStatus: "UNPAID",
      grossAmountCents: 9000,
      platformCommissionCents: 900,
      playerPayoutCents: 8100,
      ownerCommissionCents: 180,
    },
    {
      status: "APPROVED",
      paymentStatus: "PAID",
      payrollStatus: "PAID",
      grossAmountCents: 4000,
      platformCommissionCents: 400,
      playerPayoutCents: 3600,
      ownerCommissionCents: 80,
    },
  ]);

  assert.deepEqual(summary, {
    approvedCount: 2,
    grossAmountCents: 15000,
    unpaidAmountCents: 11000,
    platformCommissionCents: 1500,
    playerPayoutCents: 13500,
    ownerCommissionCents: 300,
    unpaidPayrollCents: 9900,
    platformNetCents: 1200,
  });
});

test("builds a WeChat-compatible report text from an order item", () => {
  const text = buildWechatReportText({
    orderCode: "202605230001",
    customerName: "陈发发",
    categoryName: "lol",
    playerName: "koko",
    gameId: "Linabell",
    startAt: "2026-05-23T11:47:00+08:00",
    endAt: "2026-05-23T14:29:00+08:00",
    billableMinutes: 165,
    unitPriceCents: 4000,
    grossAmountCents: 11000,
    platformCommissionCents: 1100,
    ownerName: "陈发发",
    note: "未结",
  });

  assert.equal(
    text,
    [
      "单号：202605230001",
      "老板：陈发发",
      "类别：lol",
      "陪玩：koko",
      "游戏id：Linabell",
      "时长：2.75（11:47到14:29）",
      "单价：40",
      "总价：110",
      "抽成：11",
      "直属陪玩：陈发发",
      "备注：未结",
    ].join("\n"),
  );
});
