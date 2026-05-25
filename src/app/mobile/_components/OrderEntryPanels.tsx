"use client";

import { Clipboard, Play, SquarePlus } from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";

import type { ToastApi } from "@/app/_components/feedback";
import { upsertItem } from "@/app/mobile/_components/itemState";
import { extractOrderCodeInput, validatePositiveDecimal } from "@/lib/clientInput";
import { requestJson } from "@/lib/clientHttp";
import { displayOrderCode } from "@/lib/domain";
import type { MobileBootstrapDto, OrderItemDto } from "@/lib/types";

async function copyToClipboard(text: string) {
  if (!navigator.clipboard) {
    throw new Error("当前浏览器不支持自动复制，请手动复制单号");
  }
  await navigator.clipboard.writeText(text);
}

export function OrderEntryPanels({
  bootstrap,
  setBootstrap,
  setItems,
  toast,
}: {
  bootstrap: MobileBootstrapDto;
  setBootstrap: Dispatch<SetStateAction<MobileBootstrapDto | null>>;
  setItems: Dispatch<SetStateAction<OrderItemDto[]>>;
  toast: ToastApi;
}) {
  const [customerMode, setCustomerMode] = useState("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState(bootstrap.customers[0]?.id || "");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [categoryId, setCategoryId] = useState(bootstrap.categories[0]?.id || "");
  const [unitPrice, setUnitPrice] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinUnitPrice, setJoinUnitPrice] = useState("");
  const [starting, setStarting] = useState(false);
  const [joining, setJoining] = useState(false);

  const categoryHint = useMemo(() => {
    const category = bootstrap.categories.find((candidate) => candidate.id === categoryId);
    if (!category) return "";
    return `平台抽成 ${category.platformCommissionRateBps / 100}%`;
  }, [bootstrap.categories, categoryId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void requestJson<{ customers: MobileBootstrapDto["customers"] }>(
        `/api/mobile/customers?query=${encodeURIComponent(customerSearch)}`,
      )
        .then((payload) => {
          setBootstrap((current) => (current ? { ...current, customers: payload.customers } : current));
          setCustomerId((current) => {
            if (payload.customers.some((customer) => customer.id === current)) return current;
            return payload.customers[0]?.id || "";
          });
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : "老板搜索失败");
        });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [customerSearch, setBootstrap, toast]);

  async function startOrder() {
    const price = validatePositiveDecimal(unitPrice, "单价");
    if (!price.ok) {
      toast.error(price.message);
      return;
    }
    setStarting(true);
    try {
      const payload = await requestJson<{ order: { code: string; items: OrderItemDto[] } }>("/api/mobile/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerMode === "existing" ? customerId : undefined,
          newCustomerName: customerMode === "new" ? newCustomerName : undefined,
          categoryId,
          unitPriceYuan: price.value,
        }),
      });
      const item = payload.order.items[0];
      const shortCode = displayOrderCode(payload.order.code);
      if (item) setItems((current) => upsertItem(current, item));
      setNewCustomerName("");
      toast.success(`已生成单号 ${shortCode}`, {
        label: "复制",
        onClick: async () => {
          try {
            await copyToClipboard(shortCode);
            toast.success("单号已复制");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "复制失败");
          }
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "开局失败");
    } finally {
      setStarting(false);
    }
  }

  async function joinOrder() {
    const parsed = extractOrderCodeInput(joinCode);
    if (!parsed.code) {
      toast.error("请输入单号");
      return;
    }
    const price = validatePositiveDecimal(joinUnitPrice, "单价");
    if (!price.ok) {
      toast.error(price.message);
      return;
    }

    setJoining(true);
    try {
      const payload = await requestJson<{ item: OrderItemDto }>(`/api/mobile/orders/${encodeURIComponent(parsed.code)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitPriceYuan: price.value }),
      });
      setItems((current) => upsertItem(current, payload.item));
      setJoinCode("");
      setJoinUnitPrice("");
      toast.success(parsed.normalized ? `已识别单号 ${displayOrderCode(parsed.code)} 并加入` : "已加入该单号");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加入失败");
    } finally {
      setJoining(false);
    }
  }

  return (
    <>
      <section className="panel">
        <div className="section-title">
          <h2>开局报备</h2>
          <Play size={20} />
        </div>
        <div className="form">
          <div className="field">
            <label>老板</label>
            <select className="select" value={customerMode} onChange={(event) => setCustomerMode(event.target.value)}>
              <option value="existing">选择已有老板</option>
              <option value="new">新增老板待确认</option>
            </select>
          </div>
          {customerMode === "existing" ? (
            <div className="field">
              <label>老板档案</label>
              <input className="input" placeholder="搜索老板、微信或别名" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} />
              <select className="select" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                {bootstrap.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.status === "PENDING" ? "（待确认）" : ""}
                  </option>
                ))}
              </select>
              {bootstrap.customers.length === 0 && <span className="muted">没有匹配的老板档案</span>}
            </div>
          ) : (
            <div className="field">
              <label>新老板名称</label>
              <input className="input" value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} />
            </div>
          )}
          <div className="field">
            <label>品类</label>
            <select className="select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {bootstrap.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {categoryHint && <span className="muted">{categoryHint}</span>}
          </div>
          <div className="field">
            <label>单价/小时</label>
            <input className="input" inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} />
          </div>
          <button
            className="button"
            type="button"
            disabled={!categoryId || !unitPrice.trim() || (customerMode === "existing" ? !customerId : !newCustomerName.trim()) || starting}
            onClick={startOrder}
          >
            <SquarePlus size={17} />
            {starting ? "生成中" : "开始并生成单号"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>加入已有单号</h2>
        </div>
        <div className="toolbar">
          <input className="input" placeholder="输入单号" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} />
          <input
            className="input"
            inputMode="decimal"
            pattern="[0-9]+(\\.[0-9]{1,2})?"
            placeholder="单价/小时"
            value={joinUnitPrice}
            onChange={(event) => setJoinUnitPrice(event.target.value)}
          />
          <button className="button blue" type="button" disabled={!joinCode.trim() || !joinUnitPrice.trim() || joining} onClick={joinOrder}>
            <Clipboard size={16} />
            {joining ? "加入中" : "加入"}
          </button>
        </div>
      </section>
    </>
  );
}
