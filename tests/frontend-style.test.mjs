import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("global styles define the Gemini-inspired visual system", () => {
  for (const token of [
    "--gemini-blue",
    "--gemini-purple",
    "--gemini-pink",
    "--gemini-mint",
    "--glass",
    "--glow",
  ]) {
    assert.match(css, new RegExp(`${token}:`));
  }

  assert.match(css, /\.login-hero\b/);
  assert.match(css, /\.topbar::before\b/);
  assert.match(css, /\.mobile-page \.panel\b/);
  assert.match(css, /\.table-wrap table\b/);
  assert.match(css, /\.toast-stack\b/);
  assert.match(css, /\.toast-error\b/);
  assert.match(css, /\.toast-info\b/);
  assert.match(css, /\.skeleton-card\b/);
  assert.match(css, /\.preview-card\b/);
  assert.match(css, /\.field-error\b/);
  assert.match(css, /\.table-filters\b/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
  assert.match(css, /\.amount-cell\b/);
  assert.match(css, /\.button\.status-toggle\b/);
  assert.match(css, /\.config-workspace\b/);
  assert.match(css, /\.config-matrix\b/);
  assert.match(css, /\.matrix-wrap\b/);
  assert.match(css, /\.dirty-cell\b/);
  assert.match(css, /\.dirty-toolbar\b/);
  assert.match(css, /\.customer-config-table\b/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /::selection\b/);
  assert.match(css, /:focus-visible\b/);
});
