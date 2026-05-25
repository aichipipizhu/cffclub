import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reportingSource = readFileSync("src/lib/reporting.ts", "utf8");

test("player submission recalculates from stored order item pricing", () => {
  const updateStart = reportingSource.indexOf("export async function updatePlayerOrderItem");
  const copyTextStart = reportingSource.indexOf("export async function buildCopyTextForItem");
  assert.notEqual(updateStart, -1);
  assert.notEqual(copyTextStart, -1);
  const updateSource = reportingSource.slice(updateStart, copyTextStart);

  assert.match(updateSource, /unitPriceCents:\s*item\.unitPriceCents/);
  assert.match(updateSource, /platformCommissionRateBps:\s*item\.platformCommissionRateBps/);
  assert.doesNotMatch(updateSource, /resolveCommissionForPlayer/);
});

test("order code sequence initializes from existing daily max and then increments atomically", () => {
  assert.ok(reportingSource.includes("LAST_INSERT_ID(COALESCE(MAX(CAST(SUBSTRING(\\`code\\`, 9) AS UNSIGNED)), 0) + 1)"));
  assert.match(reportingSource, /ON DUPLICATE KEY UPDATE/);
  assert.ok(reportingSource.includes("LAST_INSERT_ID(CAST(\\`value\\` AS UNSIGNED) + 1)"));
});
