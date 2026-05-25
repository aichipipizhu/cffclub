"use client";

import { Banknote, Download, LogOut, RefreshCw, TrendingUp, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { ConfigForms } from "@/app/admin/_components/ConfigForms";
import { LedgerTable } from "@/app/admin/_components/LedgerTable";
import { ReviewControls } from "@/app/admin/_components/ReviewControls";
import { CustomerSummary, PayrollSummary } from "@/app/admin/_components/SummaryTables";
import { ToastViewport, useToast } from "@/app/_components/feedback";
import { AdminSkeleton } from "@/app/_components/loading";
import { requestJson } from "@/lib/clientHttp";
import { formatYuan } from "@/lib/domain";
import type { DashboardDto, UserDto } from "@/lib/types";

function Stat({
  label,
  value,
  meta,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  meta: string;
  tone: "blue" | "amber" | "purple" | "green";
  icon: ReactNode;
}) {
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-label">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{meta}</small>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function filenameFromResponse(response: Response) {
  const header = response.headers.get("content-disposition") || "";
  const match = /filename="?([^"]+)"?/i.exec(header);
  return match?.[1] || "kabuda-report.xlsx";
}

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [tab, setTab] = useState("review");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const toast = useToast();

  const players = useMemo(() => dashboard?.users.filter((user) => user.role === "PLAYER") ?? [], [dashboard]);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }).format(new Date()),
    [],
  );
  const pendingItems = useMemo(
    () => dashboard?.items.filter((item) => item.status === "PENDING_REVIEW" || item.status === "REJECTED") ?? [],
    [dashboard],
  );
  const customerById = useMemo(
    () => new Map((dashboard?.customers ?? []).map((customer) => [customer.id, customer])),
    [dashboard?.customers],
  );

  function rangeQuery() {
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  async function load(options: { silent?: boolean } = {}) {
    if (!options.silent) setRefreshing(true);
    try {
      const me = await requestJson<{ user: UserDto | null }>("/api/auth/me");
      if (!me.user) {
        window.location.href = "/login";
        return;
      }
      if (me.user.role !== "ADMIN") {
        window.location.href = "/mobile";
        return;
      }
      const data = await requestJson<DashboardDto>(`/api/admin/dashboard${rangeQuery()}`);
      setDashboard(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load({ silent: true }).catch((error) => {
      toast.error(error instanceof Error ? error.message : "加载失败");
      setLoading(false);
    });
  }, []);

  async function exportDashboard() {
    setExporting(true);
    try {
      const response = await fetch(`/api/admin/export${rangeQuery()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "导出失败");
      }
      downloadBlob(await response.blob(), filenameFromResponse(response));
      toast.success("已开始下载报表");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  async function logout() {
    if (!window.confirm("确认退出登录？")) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "退出失败");
      setLoggingOut(false);
    }
  }

  if (loading || !dashboard) {
    return <AdminSkeleton />;
  }

  return (
    <main className="app-shell admin-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-row">
            <strong>管理后台</strong>
            <span className="date-chip">今天 {todayLabel}</span>
          </div>
          <span>流水、审核、结算与配置</span>
        </div>
        <div className="toolbar">
          <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <button className="button secondary" type="button" disabled={refreshing} onClick={() => void load()}>
            <RefreshCw size={16} />
            {refreshing ? "查询中" : "查询"}
          </button>
          <button className="button amber" type="button" disabled={exporting} onClick={() => void exportDashboard()}>
            <Download size={16} />
            {exporting ? "导出中" : "导出"}
          </button>
          <button className="button secondary" type="button" disabled={loggingOut} onClick={() => void logout()}>
            <LogOut size={16} />
            {loggingOut ? "退出中" : "退出"}
          </button>
        </div>
      </header>

      <div className="page admin-page">
        <ToastViewport toast={toast} />
        <section className="stats">
          <Stat
            label="已审核流水"
            value={formatYuan(dashboard.totals.grossAmountCents)}
            meta={`${dashboard.totals.approvedCount} 单已入账`}
            tone="blue"
            icon={<Banknote size={16} aria-hidden="true" />}
          />
          <Stat
            label="未收款"
            value={formatYuan(dashboard.totals.unpaidAmountCents)}
            meta="需要跟进回款"
            tone="amber"
            icon={<WalletCards size={16} aria-hidden="true" />}
          />
          <Stat
            label="待发薪"
            value={formatYuan(dashboard.totals.unpaidPayrollCents)}
            meta="待处理员工结算"
            tone="purple"
            icon={<WalletCards size={16} aria-hidden="true" />}
          />
          <Stat
            label="平台净收入"
            value={formatYuan(dashboard.totals.platformNetCents)}
            meta="平台抽成扣除归属提成"
            tone="green"
            icon={<TrendingUp size={16} aria-hidden="true" />}
          />
        </section>

        <nav className="tabs">
          {[
            ["review", "审核流水"],
            ["payroll", "员工周结"],
            ["customers", "老板消费"],
            ["config", "配置"],
          ].map(([value, label]) => (
            <button key={value} className={`tab ${tab === value ? "active" : ""}`} type="button" onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </nav>

        {tab === "review" && (
          <section className="grid">
            <div className="section-title">
              <h2>待审核</h2>
              <span className="muted">{pendingItems.length} 条</span>
            </div>
            {pendingItems.length === 0 ? (
              <div className="empty">暂无待审核报单</div>
            ) : (
              pendingItems.map((item) => <ReviewControls key={item.id} item={item} onDone={load} toast={toast} />)
            )}

            <div className="section-title">
              <h2>流水</h2>
              <span className="muted">
                {dashboard.items.length} 条{dashboard.itemPage.hasMore ? `，仅显示最近 ${dashboard.itemPage.limit} 条` : ""}
              </span>
            </div>
            <LedgerTable dashboard={dashboard} setDashboard={setDashboard} onRefresh={load} toast={toast} />
          </section>
        )}

        {tab === "payroll" && <PayrollSummary dashboard={dashboard} />}
        {tab === "customers" && <CustomerSummary dashboard={dashboard} customerById={customerById} />}

        {tab === "config" && <ConfigForms dashboard={dashboard} players={players} onSaved={load} toast={toast} />}
      </div>
    </main>
  );
}
