import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Windows deploy script includes the full production deployment flow", () => {
  const script = readFileSync("scripts/deploy.ps1", "utf8");

  for (const required of [
    "https://github.com/aichipipizhu/cffclub.git",
    'Ensure-Command "git"',
    'Ensure-Command "node"',
    'Ensure-Command "npm"',
    "git clone",
    "git pull",
    "npm ci",
    "npx prisma migrate deploy",
    "npm install -g pm2",
    "pm2 start npm",
    "pm2 restart",
    "pm2 save",
    "pm2-startup install",
  ]) {
    assert.match(script, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("README documents the production one-command deployment script", () => {
  const readme = readFileSync("README.md", "utf8");

  assert.match(readme, /scripts\\deploy\.ps1/);
  assert.match(readme, /DATABASE_URL/);
  assert.match(readme, /AUTH_SECRET/);
  assert.match(readme, /PM2/);
});
