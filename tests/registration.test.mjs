import assert from "node:assert/strict";
import test from "node:test";

import { parseRegistrationInput } from "../src/lib/registration.ts";

test("normalizes registration username to lowercase and returns player-safe fields", () => {
  const input = parseRegistrationInput({
    username: "KoKo_01",
    displayName: " koko ",
    password: "player123",
    role: "ADMIN",
  });

  assert.deepEqual(input, {
    username: "koko_01",
    displayName: "koko",
    password: "player123",
  });
});

test("rejects invalid usernames", () => {
  assert.throws(
    () =>
      parseRegistrationInput({
        username: "可可",
        displayName: "可可",
        password: "player123",
      }),
    /账号只能使用英文、数字、下划线，长度 3-32 位/,
  );
});

test("rejects blank display names", () => {
  assert.throws(
    () =>
      parseRegistrationInput({
        username: "koko",
        displayName: "   ",
        password: "player123",
      }),
    /请填写昵称/,
  );
});

test("rejects short passwords", () => {
  assert.throws(
    () =>
      parseRegistrationInput({
        username: "koko",
        displayName: "koko",
        password: "12345",
      }),
    /密码至少 6 位/,
  );
});
