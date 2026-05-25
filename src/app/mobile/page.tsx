"use client";

import { Inbox, LogOut, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ToastViewport, useToast } from "@/app/_components/feedback";
import { MobileSkeleton } from "@/app/_components/loading";
import { ItemCard } from "@/app/mobile/_components/ItemCard";
import { OrderEntryPanels } from "@/app/mobile/_components/OrderEntryPanels";
import { upsertItem } from "@/app/mobile/_components/itemState";
import { requestJson } from "@/lib/clientHttp";
import type { MobileBootstrapDto, OrderItemDto, UserDto } from "@/lib/types";

type ItemFilter = "ALL" | "STARTED" | "PENDING_REVIEW" | "REJECTED" | "APPROVED";

const itemFilters: Array<[ItemFilter, string]> = [
  ["ALL", "全部"],
  ["STARTED", "进行中"],
  ["PENDING_REVIEW", "待审核"],
  ["REJECTED", "已驳回"],
  ["APPROVED", "已入账"],
];

export default function MobilePage() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [bootstrap, setBootstrap] = useState<MobileBootstrapDto | null>(null);
  const [items, setItems] = useState<OrderItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [itemFilter, setItemFilter] = useState<ItemFilter>("ALL");
  const toast = useToast();

  const customers = bootstrap?.customers ?? [];
  const categories = bootstrap?.categories ?? [];

  const filteredItems = useMemo(() => {
    if (itemFilter === "ALL") return items;
    return items.filter((item) => item.status === itemFilter);
  }, [itemFilter, items]);

  async function load(options: { silent?: boolean } = {}) {
    if (!options.silent) setRefreshing(true);
    try {
      const me = await requestJson<{ user: UserDto | null }>("/api/auth/me");
      if (!me.user) {
        window.location.href = "/login";
        return;
      }
      if (me.user.role === "ADMIN") {
        window.location.href = "/admin";
        return;
      }
      setUser(me.user);

      const [boot, list] = await Promise.all([
        requestJson<MobileBootstrapDto>("/api/mobile/bootstrap"),
        requestJson<{ items: OrderItemDto[] }>("/api/mobile/orders"),
      ]);
      setBootstrap(boot);
      setItems(list.items);
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

  if (loading) {
    return <MobileSkeleton />;
  }

  return (
    <main className="app-shell mobile-shell">
      <header className="topbar">
        <div className="brand">
          <strong>陪玩报备</strong>
          <span>{user?.displayName}</span>
        </div>
        <div className="toolbar">
          <button className="button secondary" type="button" disabled={refreshing} onClick={() => void load()}>
            <RefreshCw size={16} />
            {refreshing ? "刷新中" : "刷新"}
          </button>
          <button className="button secondary" type="button" disabled={loggingOut} onClick={() => void logout()}>
            <LogOut size={16} />
            {loggingOut ? "退出中" : "退出"}
          </button>
        </div>
      </header>

      <div className="page mobile-page grid">
        <section className="mobile-hero">
          <h1>今日报备</h1>
          <p>开局生成单号，结束补充时间与备注，提交后进入后台审核。</p>
          <div className="hero-metrics">
            <span>{items.length} 条报单</span>
            <span>{customers.length} 个老板档案</span>
            <span>{categories.length} 个品类</span>
          </div>
        </section>
        <ToastViewport toast={toast} />

        {bootstrap && <OrderEntryPanels bootstrap={bootstrap} setBootstrap={setBootstrap} setItems={setItems} toast={toast} />}

        <section className="grid">
          <div className="section-title">
            <h2>我的报单</h2>
            <span className="muted">{filteredItems.length} 条</span>
          </div>
          <nav className="tabs compact-tabs" aria-label="报单状态筛选">
            {itemFilters.map(([value, label]) => (
              <button key={value} className={`tab ${itemFilter === value ? "active" : ""}`} type="button" onClick={() => setItemFilter(value)}>
                {label}
              </button>
            ))}
          </nav>
          {filteredItems.length === 0 ? (
            <div className="empty">
              <Inbox size={28} aria-hidden="true" />
              <strong>暂无报单</strong>
              <span>开局后会出现在这里</span>
              <button className="button" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                立即报备
              </button>
            </div>
          ) : (
            filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} onChanged={(updated) => setItems((current) => upsertItem(current, updated))} toast={toast} />
            ))
          )}
        </section>
      </div>
    </main>
  );
}
