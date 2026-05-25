import assert from "node:assert/strict";
import test from "node:test";

import { previewOrderItemPricing } from "../src/lib/domain.ts";

const baseInput = {
  startAt: "2026-05-23T11:47",
  endAt: "2026-05-23T14:29",
  unitPriceCents: 4000,
  platformCommissionRateBps: 1000,
  ownerCommissionRateBps: 2000,
};

test("previews mobile order item pricing without saving", () => {
  const result = previewOrderItemPricing(baseInput);

  assert.deepEqual(result, {
    ok: true,
    pricing: {
      billableMinutes: 165,
      billableHours: 2.75,
      grossAmountCents: 11000,
      platformCommissionCents: 1100,
      playerPayoutCents: 9900,
      ownerCommissionCents: 220,
    },
  });
});

test("requires an end time before previewing", () => {
  const result = previewOrderItemPricing({ ...baseInput, endAt: "" });

  assert.deepEqual(result, {
    ok: false,
    message: "请先填写结束时间",
  });
});

test("rejects a preview ending before the start time", () => {
  const result = previewOrderItemPricing({
    ...baseInput,
    endAt: "2026-05-23T10:00",
  });

  assert.deepEqual(result, {
    ok: false,
    message: "结束时间必须晚于开始时间",
  });
});

test("rejects invalid preview times", () => {
  const result = previewOrderItemPricing({
    ...baseInput,
    startAt: "invalid",
  });

  assert.deepEqual(result, {
    ok: false,
    message: "时间格式不正确",
  });
});
