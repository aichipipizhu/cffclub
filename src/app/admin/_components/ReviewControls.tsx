"use client";

import { CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";

import type { ToastApi } from "@/app/_components/feedback";
import { fromInputDateTime, statusBadge, toInputDateTime } from "@/lib/clientFormat";
import { validatePercentInput, validatePositiveDecimal } from "@/lib/clientInput";
import { requestJson } from "@/lib/clientHttp";
import { centsToYuan, displayOrderCode } from "@/lib/domain";
import type { OrderItemDto } from "@/lib/types";

function percent(value: number): string {
  return String(value / 100);
}

export function ReviewControls({
  item,
  onDone,
  toast,
}: {
  item: OrderItemDto;
  onDone: () => Promise<void>;
  toast: ToastApi;
}) {
  const [unitPrice, setUnitPrice] = useState(centsToYuan(item.unitPriceCents));
  const [commission, setCommission] = useState(percent(item.platformCommissionRateBps));
  const [endAt, setEndAt] = useState(toInputDateTime(item.endAt));
  const [note, setNote] = useState(item.note || "");
  const [reason, setReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [busy, setBusy] = useState<"APPROVE" | "REJECT" | null>(null);
  const [error, setError] = useState("");

  async function review(action: "APPROVE" | "REJECT") {
    const price = validatePositiveDecimal(unitPrice, "单价");
    if (!price.ok) {
      setError(price.message);
      return;
    }
    const commissionPercent = validatePercentInput(commission, "平台抽成", { required: true });
    if (!commissionPercent.ok) {
      setError(commissionPercent.message);
      return;
    }
    if (action === "APPROVE" && !window.confirm("确认通过入账？金额会进入聚合统计。")) return;

    setBusy(action);
    setError("");
    try {
      await requestJson(`/api/admin/items/${item.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason,
          endAt: fromInputDateTime(endAt),
          unitPriceYuan: price.value,
          platformCommissionPercent: commissionPercent.value,
          note,
        }),
      });
      toast.success(action === "APPROVE" ? "已审核入账" : "已驳回");
      await onDone();
    } catch (reviewError) {
      toast.error(reviewError instanceof Error ? reviewError.message : "审核失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card item-card">
      <div className="item-meta">
        <div>
          <strong>#{displayOrderCode(item.order.code)}</strong>
          <div className="muted">
            {item.order.customer.name} / {item.order.category.name} / {item.player.displayName}
          </div>
        </div>
        {statusBadge(item.status)}
      </div>
      <div className="grid three">
        <div className="field">
          <label>结束时间</label>
          <input className="input" type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
        </div>
        <div className="field">
          <label>单价</label>
          <input className="input" inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} />
        </div>
        <div className="field">
          <label>平台抽成%</label>
          <input className="input" inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" value={commission} onChange={(event) => setCommission(event.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>备注</label>
        <input className="input" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {rejectOpen && (
        <div className="inline-confirm">
          <div className="field">
            <label>驳回原因</label>
            <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <button className="button red" type="button" disabled={busy !== null} onClick={() => void review("REJECT")}>
            <XCircle size={16} />
            {busy === "REJECT" ? "驳回中" : "确认驳回"}
          </button>
        </div>
      )}
      {error && <div className="field-error">{error}</div>}
      <div className="toolbar">
        <button className="button" type="button" disabled={busy !== null} onClick={() => void review("APPROVE")}>
          <CheckCircle size={16} />
          {busy === "APPROVE" ? "入账中" : "通过入账"}
        </button>
        <button className="button red" type="button" disabled={busy !== null} onClick={() => setRejectOpen((current) => !current)}>
          <XCircle size={16} />
          {rejectOpen ? "收起驳回" : "驳回"}
        </button>
      </div>
    </div>
  );
}
