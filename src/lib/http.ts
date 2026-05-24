import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser, type SessionUser } from "@/lib/auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function created<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { status: 201 });
}

export function handleRouteError(error: unknown): NextResponse<{ error: string }> {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "请求参数不正确" }, { status: 400 });
  }

  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: "服务器错误" }, { status: 500 });
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, "请先登录");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "没有后台权限");
  }
  return user;
}

export async function readJson<T>(request: Request, schema: z.Schema<T>): Promise<T> {
  const body = await request.json();
  return schema.parse(body);
}

export function parseDateRange(url: URL): { from?: Date; to?: Date } {
  const fromValue = url.searchParams.get("from");
  const toValue = url.searchParams.get("to");
  const from = fromValue ? new Date(fromValue) : undefined;
  const to = toValue ? new Date(toValue) : undefined;

  return {
    from: from && Number.isFinite(from.getTime()) ? from : undefined,
    to: to && Number.isFinite(to.getTime()) ? to : undefined,
  };
}
