import { CheckCircle, Clock3, PlayCircle, XCircle } from "lucide-react";

import type { ItemStatus } from "@/lib/domain";

export function toInputDateTime(value?: string | Date | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function fromInputDateTime(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export function statusBadge(status: ItemStatus) {
  if (status === "APPROVED") {
    return (
      <span className="badge green">
        <CheckCircle size={12} aria-hidden="true" /> 已入账
      </span>
    );
  }
  if (status === "PENDING_REVIEW") {
    return (
      <span className="badge amber">
        <Clock3 size={12} aria-hidden="true" /> 待审核
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="badge red">
        <XCircle size={12} aria-hidden="true" /> 已驳回
      </span>
    );
  }
  return (
    <span className="badge">
      <PlayCircle size={12} aria-hidden="true" /> 进行中
    </span>
  );
}
