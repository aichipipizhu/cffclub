import assert from "node:assert/strict";
import test from "node:test";

import { joinOrderSchema, startOrderSchema } from "../src/lib/mobileOrderInput.ts";
import { extractOrderCodeInput, validatePositiveDecimal } from "../src/lib/clientInput.ts";

test("mobile start order input requires a positive self-entered unit price", () => {
  assert.equal(
    startOrderSchema.safeParse({ categoryId: "category-1", unitPriceYuan: 40 }).success,
    true,
  );
  assert.equal(
    startOrderSchema.safeParse({ categoryId: "category-1", unitPriceYuan: 0 }).success,
    false,
  );
});

test("mobile join order input requires a positive self-entered unit price", () => {
  assert.equal(joinOrderSchema.safeParse({ unitPriceYuan: 35.5 }).success, true);
  assert.equal(joinOrderSchema.safeParse({ unitPriceYuan: -1 }).success, false);
});

test("client order code input reports visible normalization", () => {
  assert.deepEqual(extractOrderCodeInput("单号 0421"), { code: "0421", normalized: true });
  assert.deepEqual(extractOrderCodeInput("0421"), { code: "0421", normalized: false });
  assert.deepEqual(extractOrderCodeInput("没有数字"), { code: "", normalized: false });
});

test("client decimal validation rejects scientific notation", () => {
  assert.deepEqual(validatePositiveDecimal("35.5", "单价"), { ok: true, value: 35.5 });
  assert.equal(validatePositiveDecimal("1e5", "单价").ok, false);
  assert.equal(validatePositiveDecimal("-1", "单价").ok, false);
});
