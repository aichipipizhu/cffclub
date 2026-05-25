"use client";

import { Calculator, Clipboard, Send } from "lucide-react";
import { useState } from "react";

import type { ToastApi } from "@/app/_components/feedback";
import { fromInputDateTime, statusBadge, toInputDateTime } from "@/lib/clientFormat";
import { requestJson } from "@/lib/clientHttp";
import { billableHoursLabel, centsToYuan, displayOrderCode, previewOrderItemPricing } from "@/lib/domain";
import type { OrderItemDto } from "@/lib/types";

export function ItemCard({
  item,
  onChanged,
  toast,
}: {
  item: OrderItemDto;
  onChanged: (item: OrderItemDto) => void;
  toast: ToastApi;
}) {
  const locked = item.status === "APPROVED";
  const [startAt, setStartAt] = useState(toInputDateTime(item.startAt));
  const [endAt, setEndAt] = useState(toInputDateTime(item.endAt));
  const [gameId, setGameId] = useState(item.gameId || "");
  const [note, setNote] = useState(item.note || "");
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [previewPricing, setPreviewPricing] = useState<{
    billableMinutes: number;
    grossAmountCents: number;
    playerPayoutCents: number;
  } | null>(null);

  const shownBillableMinutes = previewPricing?.billableMinutes ?? item.billableMinutes;
  const shownGrossAmountCents = previewPricing?.grossAmountCents ?? item.grossAmountCents;
  const shownPlayerPayoutCents = previewPricing?.playerPayoutCents ?? item.playerPayoutCents;

  function clearPreview() {
    setPreviewPricing(null);
  }

  async function submitItem(endAtOverride?: string) {
    setBusy(true);
    try {
      const payload = await requestJson<{ item: OrderItemDto }>(`/api/mobile/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: fromInputDateTime(startAt),
          endAt: fromInputDateTime(endAtOverride ?? endAt),
          gameId,
          note,
          submit: true,
        }),
      });
      toast.success("已提交审核");
      setPreviewPricing(null);
      onChanged(payload.item);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  function handlePreview() {
    const result = previewOrderItemPricing({
      startAt,
      endAt,
      unitPriceCents: item.unitPriceCents,
      platformCommissionRateBps: item.platformCommissionRateBps,
      ownerCommissionRateBps: item.ownerCommissionRateBps,
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setPreviewPricing(result.pricing);
    toast.info("已生成预览，尚未保存");
  }

  async function copyReportText() {
    setCopying(true);
    try {
      const payload = await requestJson<{ text: string }>(`/api/mobile/items/${item.id}/copy`);
      if (!navigator.clipboard) {
        throw new Error("当前浏览器不支持自动复制，请手动复制文案");
      }
      await navigator.clipboard.writeText(payload.text);
      toast.success("微信群文案已复制");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "复制失败");
    } finally {
      setCopying(false);
    }
  }

  return (
    <article className={`card item-card ${previewPricing ? "preview-card" : ""}`}>
      <div className="item-meta">
        <div>
          <strong>#{displayOrderCode(item.order.code)}</strong>
          <div className="muted">
            {item.order.customer.name} / {item.order.category.name}
          </div>
        </div>
        {statusBadge(item.status)}
      </div>

      {item.rejectedReason && <div className="badge red">驳回：{item.rejectedReason}</div>}
      {previewPricing && <div className="preview-hint">预览未保存，提交后才会进入后台审核。</div>}

      <div className="grid two">
        <div className="field">
          <label>开始时间</label>
          <input
            className="input"
            type="datetime-local"
            value={startAt}
            disabled={locked}
            onChange={(event) => {
              setStartAt(event.target.value);
              clearPreview();
            }}
          />
        </div>
        <div className="field">
          <div className="field-label-row">
            <label>结束时间</label>
            <button
              className="link-button"
              type="button"
              disabled={locked}
              onClick={() => {
                setEndAt(toInputDateTime(new Date()));
                clearPreview();
              }}
            >
              现在
            </button>
          </div>
          <input
            className="input"
            type="datetime-local"
            value={endAt}
            disabled={locked}
            onChange={(event) => {
              setEndAt(event.target.value);
              clearPreview();
            }}
          />
        </div>
      </div>

      <div className="grid two">
        <div className="field">
          <label>游戏 ID</label>
          <input
            className="input"
            value={gameId}
            disabled={locked}
            onChange={(event) => {
              setGameId(event.target.value);
              clearPreview();
            }}
          />
        </div>
        <div className="field">
          <label>备注</label>
          <input
            className="input"
            value={note}
            disabled={locked}
            onChange={(event) => {
              setNote(event.target.value);
              clearPreview();
            }}
          />
        </div>
      </div>

      <div className="grid three">
        <div className="stat">
          <span>时长</span>
          <strong>{shownBillableMinutes ? billableHoursLabel(shownBillableMinutes) : "-"}</strong>
        </div>
        <div className="stat">
          <span>总价</span>
          <strong>{shownGrossAmountCents ? centsToYuan(shownGrossAmountCents) : "-"}</strong>
        </div>
        <div className="stat">
          <span>酬劳</span>
          <strong>{shownPlayerPayoutCents ? centsToYuan(shownPlayerPayoutCents) : "-"}</strong>
        </div>
      </div>

      <div className="toolbar">
        <button className="button secondary" type="button" disabled={busy || locked} onClick={handlePreview}>
          <Calculator size={16} />
          预览
        </button>
        <button
          className="button blue"
          type="button"
          disabled={busy || locked}
          onClick={async () => {
            const effectiveEndAt = endAt || toInputDateTime(new Date());
            if (!endAt) setEndAt(effectiveEndAt);
            await submitItem(effectiveEndAt);
          }}
        >
          <Send size={16} />
          {busy ? "提交中" : "提交"}
        </button>
        <button className="button amber" type="button" disabled={!item.endAt || copying} onClick={copyReportText}>
          <Clipboard size={16} />
          {copying ? "复制中" : "复制"}
        </button>
      </div>
    </article>
  );
}
