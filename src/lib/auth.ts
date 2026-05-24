import { createHmac } from "node:crypto";

import type { Role, User } from "@prisma/client";
import { cookies } from "next/headers";

export { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "kabuda_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = Pick<User, "id" | "username" | "displayName" | "role" | "active">;

type SessionPayload = {
  userId: string;
  role: Role;
  exp: number;
};

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production");
  }

  return "kabuda-development-secret-change-me";
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string): string {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const body: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = base64url(JSON.stringify(body));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token?: string): SessionPayload | null {
  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || sign(encoded) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || !payload.role || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: Pick<User, "id" | "role">): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken({ userId: user.id, role: user.role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      active: true,
    },
  });

  if (!user?.active) {
    return null;
  }

  return user;
}
