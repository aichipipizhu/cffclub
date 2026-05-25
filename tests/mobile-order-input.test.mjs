import assert from "node:assert/strict";
import test from "node:test";

import { joinOrderSchema, startOrderSchema } from "../src/lib/mobileOrderInput.ts";

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
