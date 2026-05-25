import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const configSource = readFileSync("src/lib/config.ts", "utf8");
const reportingSource = readFileSync("src/lib/reporting.ts", "utf8");
const overrideMatrixSource = readFileSync("src/app/admin/config/OverrideMatrix.tsx", "utf8");
const categoryTableSource = readFileSync("src/app/admin/config/CategoryTable.tsx", "utf8");
const customerTableSource = readFileSync("src/app/admin/config/CustomerTable.tsx", "utf8");

test("dashboard includes pricing overrides for the config matrix", () => {
  assert.match(reportingSource, /playerPricingOverride\.findMany/);
  assert.match(reportingSource, /pricingOverrides/);
});

test("override batch saves and clears rules in one transaction", () => {
  const start = configSource.indexOf("export async function batchSavePricingOverrides");
  const end = configSource.indexOf("export async function batchSaveCategories");
  const source = configSource.slice(start, end);

  assert.match(source, /\$transaction/);
  assert.match(source, /playerPricingOverride\.upsert/);
  assert.match(source, /playerPricingOverride\.deleteMany/);
  assert.match(source, /platformCommissionPercent === null/);
});

test("category and customer batch saves are transactional", () => {
  assert.match(configSource, /export async function batchSaveCategories/);
  assert.match(configSource, /export async function batchSaveCustomers/);
  assert.match(configSource, /tx\.category\.create/);
  assert.match(configSource, /tx\.category\.update/);
  assert.match(configSource, /tx\.customer\.create/);
  assert.match(configSource, /tx\.customer\.update/);
  assert.match(configSource, /deleteMany: \{\}/);
});

test("config UI exposes matrix, category table, and customer table workflows", () => {
  assert.match(overrideMatrixSource, /config-matrix/);
  assert.match(overrideMatrixSource, /dirty-toolbar/);
  assert.match(overrideMatrixSource, /\/api\/admin\/overrides\/batch/);
  assert.match(categoryTableSource, /\/api\/admin\/categories\/batch/);
  assert.match(customerTableSource, /\/api\/admin\/customers\/batch/);
});

