"use client";

import { Calculator, Clipboard, LogOut, Play, RefreshCw, Send, SquarePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  billableHoursLabel,
  centsToYuan,
  displayOrderCode,
  previewOrderItemPricing,
} from "@/lib/domain";

type User = {
  id: string;
  displayName: string;
  role: "ADMIN" | "PLAYER";
};

type Customer = {
  id: string;
  name: string;
  status: "PENDING" | "CONFIRMED";
  owner?: { displayName: string } | null;
};

type Category = {
  id: string;
  name: string;
  unitPriceCents: number;
  platformCommissionRateBps: number;
};

type OrderItem = {
  id: string;
  status: "STARTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  gameId?: string | null;
  note?: string | null;
  startAt: string;
  endAt?: string | null;
  billableMinutes: number;
  unitPriceCents: number;
  grossAmountCents: number;
  platformCommissionRateBps: number;
  platformCommissionCents: number;
  playerPayoutCents: number;
  ownerCommissionRateBps: number;
  rejectedReason?: string | null;
  order: {
    code: string;
    paymentStatus: "UNPAID" | "PAID";
    customer: Customer;
    category: Category;
  };
};

type BootstrapPayload = {
  customers: Customer[];
  categories: Category[];
  activeItems: OrderItem[];
};

function toInputDateTime(value?: string | Date | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromInputDateTime(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }
  return payload;
}

function statusBadge(status: OrderItem["status"]) {
  if (status === "APPROVED") return <span className="badge green">已入账</span>;
  if (status === "PENDING_REVIEW") return <span className="badge amber">待审核</span>;
  if (status === "REJECTED") return <span className="badge red">已驳回</span>;
  return <span className="badge">进行中</span>;
}

function ItemCard({
  item,
  onChanged,
  setToast,
}: {
  item: OrderItem;
  onChanged: () => Promise<void>;
  setToast: (message: string) => void;
}) {
  const locked = item.status === "APPROVED";
  const [startAt, setStartAt] = useState(toInputDateTime(item.startAt));
  const [endAt, setEndAt] = useState(toInputDateTime(item.endAt));
  const [gameId, setGameId] = useState(item.gameId || "");
  const [note, setNote] = useState(item.note || "");
  const [busy, setBusy] = useState(false);
  const [previewPricing, setPreviewPricing] = useState<{
    billableMinutes: number;
    grossAmountCents: number;
    playerPayoutCents: number;
  } | null>(null);

  const shownBillableMinutes = previewPricing?.billableMinutes ?? item.billableMinutes;
  const shownGrossAmountCents = previewPricing?.grossAmountCents ?? item.grossAmountCents;
  const shownPlayerPayoutCents = previewPricing?.playerPayoutCents ?? item.playerPayoutCents;
  const shownBillableHoursLabel = previewPricing
    ? billableHoursLabel(shownBillableMinutes)
    : shownBillableMinutes
      ? billableHoursLabel(shownBillableMinutes)
      : "-";
  const shownGrossAmountLabel = previewPricing
    ? centsToYuan(shownGrossAmountCents)
    : shownGrossAmountCents
      ? centsToYuan(shownGrossAmountCents)
      : "-";
  const shownPlayerPayoutLabel = previewPricing
    ? centsToYuan(shownPlayerPayoutCents)
    : shownPlayerPayoutCents
      ? centsToYuan(shownPlayerPayoutCents)
      : "-";

  async function submitItem(endAtOverride?: string) {
    setBusy(true);
    try {
      await requestJson(`/api/mobile/items/${item.id}`, {
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
      setToast("已提交审核");
      setPreviewPricing(null);
      await onChanged();
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
      setToast(result.message);
      return;
    }

    setPreviewPricing(result.pricing);
    setToast("已生成预览");
  }

  return (
    <article className="card item-card">
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
              setPreviewPricing(null);
            }}
          />
        </div>
        <div className="field">
          <label>结束时间</label>
          <input
            className="input"
            type="datetime-local"
            value={endAt}
            disabled={locked}
            onChange={(event) => {
              setEndAt(event.target.value);
              setPreviewPricing(null);
            }}
          />
        </div>
      </div>

      <div className="grid two">
        <div className="field">
          <label>游戏 ID</label>
          <input className="input" value={gameId} disabled={locked} onChange={(event) => setGameId(event.target.value)} />
        </div>
        <div className="field">
          <label>备注</label>
          <input className="input" value={note} disabled={locked} onChange={(event) => setNote(event.target.value)} />
        </div>
      </div>

      <div className="grid three">
        <div className="stat">
          <span>时长</span>
          <strong>{shownBillableHoursLabel}</strong>
        </div>
        <div className="stat">
          <span>总价</span>
          <strong>{shownGrossAmountLabel}</strong>
        </div>
        <div className="stat">
          <span>酬劳</span>
          <strong>{shownPlayerPayoutLabel}</strong>
        </div>
      </div>

      <div className="toolbar">
        <button className="button secondary" disabled={busy || locked} onClick={handlePreview}>
          <Calculator size={16} />
          预览
        </button>
        <button
          className="button blue"
          disabled={busy || locked}
          onClick={async () => {
            const effectiveEndAt = endAt || toInputDateTime(new Date());
            if (!endAt) {
              setEndAt(effectiveEndAt);
            }
            await submitItem(effectiveEndAt);
          }}
        >
          <Send size={16} />
          提交
        </button>
        <button
          className="button amber"
          disabled={!item.endAt}
          onClick={async () => {
            const payload = await requestJson<{ text: string }>(`/api/mobile/items/${item.id}/copy`);
            await navigator.clipboard.writeText(payload.text);
            setToast("微信群文案已复制");
          }}
        >
          <Clipboard size={16} />
          复制
        </button>
      </div>
    </article>
  );
}

export default function MobilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [customerMode, setCustomerMode] = useState("existing");
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const customers = bootstrap?.customers ?? [];
  const categories = bootstrap?.categories ?? [];

  const categoryHint = useMemo(() => {
    const category = categories.find((candidate) => candidate.id === categoryId);
    if (!category) return "";
    return `默认单价 ${centsToYuan(category.unitPriceCents)} 元/小时，平台抽成 ${category.platformCommissionRateBps / 100}%`;
  }, [categories, categoryId]);

  async function load() {
    const me = await requestJson<{ user: User | null }>("/api/auth/me");
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
      requestJson<BootstrapPayload>("/api/mobile/bootstrap"),
      requestJson<{ items: OrderItem[] }>("/api/mobile/orders"),
    ]);
    setBootstrap(boot);
    setItems(list.items);
    setCustomerId(boot.customers[0]?.id || "");
    setCategoryId(boot.categories[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    void load().catch((error) => {
      setToast(error instanceof Error ? error.message : "加载失败");
      setLoading(false);
    });
  }, []);

  async function startOrder() {
    await requestJson("/api/mobile/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: customerMode === "existing" ? customerId : undefined,
        newCustomerName: customerMode === "new" ? newCustomerName : undefined,
        categoryId,
      }),
    });
    setToast("已报备开局并生成单号");
    setNewCustomerName("");
    await load();
  }

  async function joinOrder() {
    const code = joinCode.replace(/\D/g, "");
    if (!code) {
      setToast("请输入单号");
      return;
    }

    setJoining(true);
    try {
      await requestJson(`/api/mobile/orders/${encodeURIComponent(code)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setToast("已加入该单号");
      setJoinCode("");
      await load();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "加入失败");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return <main className="page mobile-page">加载中...</main>;
  }

  return (
    <main className="app-shell mobile-shell">
      <header className="topbar">
        <div className="brand">
          <strong>陪玩报备</strong>
          <span>{user?.displayName}</span>
        </div>
        <div className="toolbar">
          <button className="button secondary" onClick={() => void load()}>
            <RefreshCw size={16} />
            刷新
          </button>
          <button
            className="button secondary"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            <LogOut size={16} />
            退出
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
        {toast && <div className="toast">{toast}</div>}

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
                <select className="select" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.status === "PENDING" ? "（待确认）" : ""}
                    </option>
                  ))}
                </select>
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
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {categoryHint && <span className="muted">{categoryHint}</span>}
            </div>
            <button className="button" disabled={!categoryId || (customerMode === "existing" ? !customerId : !newCustomerName)} onClick={startOrder}>
              <SquarePlus size={17} />
              开始并生成单号
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <h2>加入已有单号</h2>
          </div>
          <div className="toolbar">
            <input className="input" placeholder="输入单号" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} />
            <button className="button blue" disabled={!joinCode.trim() || joining} onClick={joinOrder}>
              {joining ? "加入中" : "加入"}
            </button>
          </div>
        </section>

        <section className="grid">
          <div className="section-title">
            <h2>我的报单</h2>
            <span className="muted">{items.length} 条</span>
          </div>
          {items.length === 0 ? (
            <div className="empty">暂无报单</div>
          ) : (
            items.map((item) => <ItemCard key={item.id} item={item} onChanged={load} setToast={setToast} />)
          )}
        </section>
      </div>
    </main>
  );
}
