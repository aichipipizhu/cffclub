"use client";

import { useMemo, useState } from "react";

import type { ToastApi } from "@/app/_components/feedback";
import { statusBadge } from "@/lib/clientFormat";
import { requestJson } from "@/lib/clientHttp";
import { billableHoursLabel, displayOrderCode, formatYuan } from "@/lib/domain";
import type { DashboardDto, OrderItemDto } from "@/lib/types";

type SortKey = "code" | "customer" | "player" | "startAt" | "amount" | "status" | "payment";

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function sortValue(item: OrderItemDto, key: SortKey): string | number {
  if (key === "code") return item.order.code;
  if (key === "customer") return item.order.customer.name;
  if (key === "player") return item.player.displayName;
  if (key === "startAt") return new Date(item.startAt).getTime();
  if (key === "amount") return item.grossAmountCents;
  if (key === "payment") return item.order.paymentStatus;
  return item.status;
}

function compareItems(a: OrderItemDto, b: OrderItemDto, key: SortKey, direction: "asc" | "desc") {
  const left = sortValue(a, key);
  const right = sortValue(b, key);
  const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "zh-CN");
  return direction === "asc" ? result : -result;
}

export function LedgerTable({
  dashboard,
  setDashboard,
  onRefresh,
  toast,
}: {
  dashboard: DashboardDto;
  setDashboard: (updater: (current: DashboardDto | null) => DashboardDto | null) => void;
  onRefresh: () => Promise<void>;
  toast: ToastApi;
}) {
  const [playerFilter, setPlayerFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "startAt", direction: "desc" });
  const [page, setPage] = useState(1);
  const [busyKey, setBusyKey] = useState("");
  const pageSize = 50;

  const players = useMemo(() => Array.from(new Set(dashboard.items.map((item) => item.player.displayName))).sort(), [dashboard.items]);
  const customers = useMemo(() => Array.from(new Set(dashboard.items.map((item) => item.order.customer.name))).sort(), [dashboard.items]);

  const filteredItems = useMemo(() => {
    return dashboard.items
      .filter((item) => !playerFilter || item.player.displayName === playerFilter)
      .filter((item) => !customerFilter || item.order.customer.name === customerFilter)
      .filter((item) => !statusFilter || item.status === statusFilter)
      .filter((item) => !paymentFilter || item.order.paymentStatus === paymentFilter)
      .sort((a, b) => compareItems(a, b, sort.key, sort.direction));
  }, [customerFilter, dashboard.items, paymentFilter, playerFilter, sort, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  async function togglePayment(item: OrderItemDto) {
    const paid = item.order.paymentStatus !== "PAID";
    const previous = dashboard;
    setBusyKey(`payment:${item.order.id}`);
    setDashboard((current) =>
      current
        ? {
            ...current,
            items: current.items.map((row) =>
              row.order.id === item.order.id ? { ...row, order: { ...row.order, paymentStatus: paid ? "PAID" : "UNPAID" } } : row,
            ),
          }
        : current,
    );
    try {
      await requestJson(`/api/admin/orders/${item.order.id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid }),
      });
      toast.success(paid ? "已标记收款" : "已标记未收");
      await onRefresh();
    } catch (error) {
      setDashboard(() => previous);
      toast.error(error instanceof Error ? error.message : "收款状态更新失败");
    } finally {
      setBusyKey("");
    }
  }

  async function togglePayroll(item: OrderItemDto) {
    const paid = item.payrollStatus !== "PAID";
    const previous = dashboard;
    setBusyKey(`payroll:${item.id}`);
    setDashboard((current) =>
      current
        ? {
            ...current,
            items: current.items.map((row) => (row.id === item.id ? { ...row, payrollStatus: paid ? "PAID" : "UNPAID" } : row)),
          }
        : current,
    );
    try {
      await requestJson(`/api/admin/items/${item.id}/payroll`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid }),
      });
      toast.success(paid ? "已标记发薪" : "已标记未发");
      await onRefresh();
    } catch (error) {
      setDashboard(() => previous);
      toast.error(error instanceof Error ? error.message : "发薪状态更新失败");
    } finally {
      setBusyKey("");
    }
  }

  const sortableHeader = (key: SortKey, label: string) => (
    <button className="table-sort" type="button" onClick={() => toggleSort(key)}>
      {label}
      {sort.key === key ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  return (
    <>
      <div className="table-filters">
        <select className="select" value={playerFilter} onChange={(event) => { setPlayerFilter(event.target.value); setPage(1); }}>
          <option value="">全部陪玩</option>
          {players.map((player) => <option key={player} value={player}>{player}</option>)}
        </select>
        <select className="select" value={customerFilter} onChange={(event) => { setCustomerFilter(event.target.value); setPage(1); }}>
          <option value="">全部老板</option>
          {customers.map((customer) => <option key={customer} value={customer}>{customer}</option>)}
        </select>
        <select className="select" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
          <option value="">全部状态</option>
          <option value="STARTED">进行中</option>
          <option value="PENDING_REVIEW">待审核</option>
          <option value="REJECTED">已驳回</option>
          <option value="APPROVED">已入账</option>
        </select>
        <select className="select" value={paymentFilter} onChange={(event) => { setPaymentFilter(event.target.value); setPage(1); }}>
          <option value="">全部收款</option>
          <option value="PAID">已收</option>
          <option value="UNPAID">未收</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{sortableHeader("code", "单号")}</th>
              <th>{sortableHeader("customer", "老板")}</th>
              <th>{sortableHeader("player", "陪玩")}</th>
              <th>{sortableHeader("startAt", "时间")}</th>
              <th className="amount-heading">{sortableHeader("amount", "金额")}</th>
              <th>{sortableHeader("status", "状态")}</th>
              <th>{sortableHeader("payment", "收款")}</th>
              <th>发薪</th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((item) => (
              <tr key={item.id}>
                <td>#{displayOrderCode(item.order.code)}</td>
                <td>{item.order.customer.name}</td>
                <td>{item.player.displayName}</td>
                <td className="metric-cell">
                  <span>{formatDateTime(item.startAt)}</span>
                  <small>{formatDateTime(item.endAt)}</small>
                </td>
                <td className="amount-cell">
                  <strong>{formatYuan(item.grossAmountCents)}</strong>
                  <span>
                    酬劳 {formatYuan(item.playerPayoutCents)} · 时长{" "}
                    {item.billableMinutes ? `${billableHoursLabel(item.billableMinutes)}h` : "-"}
                  </span>
                </td>
                <td>{statusBadge(item.status)}</td>
                <td>
                  <button
                    className={`button status-toggle ${item.order.paymentStatus === "PAID" ? "paid" : "unpaid"}`}
                    type="button"
                    disabled={busyKey === `payment:${item.order.id}`}
                    onClick={() => void togglePayment(item)}
                  >
                    {busyKey === `payment:${item.order.id}` ? "更新中" : item.order.paymentStatus === "PAID" ? "已收" : "未收"}
                  </button>
                </td>
                <td>
                  <button
                    className={`button status-toggle ${item.payrollStatus === "PAID" ? "paid" : "pending"}`}
                    type="button"
                    disabled={busyKey === `payroll:${item.id}`}
                    onClick={() => void togglePayroll(item)}
                  >
                    {busyKey === `payroll:${item.id}` ? "更新中" : item.payrollStatus === "PAID" ? "已发" : "未发"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span className="muted">
          第 {safePage} / {pageCount} 页，共 {filteredItems.length} 条
        </span>
        <div className="toolbar">
          <button className="button secondary" type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            上一页
          </button>
          <button className="button secondary" type="button" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
            下一页
          </button>
        </div>
      </div>
    </>
  );
}
