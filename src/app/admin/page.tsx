"use client";

import {
  CheckCircle,
  Download,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { billableHoursLabel, centsToYuan } from "@/lib/domain";

type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "PLAYER";
  active: boolean;
};

type Customer = {
  id: string;
  name: string;
  wechat?: string | null;
  note?: string | null;
  status: "PENDING" | "CONFIRMED";
  ownerId?: string | null;
  owner?: AdminUser | null;
  aliases?: { alias: string }[];
};

type Category = {
  id: string;
  name: string;
  unitPriceCents: number;
  platformCommissionRateBps: number;
  active: boolean;
};

type OrderItem = {
  id: string;
  status: "STARTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  payrollStatus: "UNPAID" | "PAID";
  startAt: string;
  endAt?: string | null;
  billableMinutes: number;
  unitPriceCents: number;
  grossAmountCents: number;
  platformCommissionRateBps: number;
  platformCommissionCents: number;
  playerPayoutCents: number;
  ownerCommissionCents: number;
  gameId?: string | null;
  note?: string | null;
  rejectedReason?: string | null;
  player: AdminUser;
  order: {
    id: string;
    code: string;
    paymentStatus: "UNPAID" | "PAID";
    customer: Customer;
    category: Category;
  };
};

type SummaryRow = {
  playerId?: string;
  playerName?: string;
  customerId?: string;
  customerName?: string;
  amountCents: number;
  unpaidCents?: number;
  count: number;
};

type Dashboard = {
  totals: {
    approvedCount: number;
    grossAmountCents: number;
    unpaidAmountCents: number;
    platformCommissionCents: number;
    playerPayoutCents: number;
    ownerCommissionCents: number;
    unpaidPayrollCents: number;
    platformNetCents: number;
  };
  items: OrderItem[];
  customers: Customer[];
  users: AdminUser[];
  categories: Category[];
  payrollByPlayer: SummaryRow[];
  spendByCustomer: SummaryRow[];
  ownerCommissionByPlayer: SummaryRow[];
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }
  return payload;
}

function toInputDateTime(value?: string | Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromInputDateTime(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

function percent(value: number): string {
  return String(value / 100);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusBadge(status: OrderItem["status"]) {
  if (status === "APPROVED") return <span className="badge green">已入账</span>;
  if (status === "PENDING_REVIEW") return <span className="badge amber">待审核</span>;
  if (status === "REJECTED") return <span className="badge red">已驳回</span>;
  return <span className="badge">进行中</span>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReviewControls({
  item,
  onDone,
  setToast,
}: {
  item: OrderItem;
  onDone: () => Promise<void>;
  setToast: (message: string) => void;
}) {
  const [unitPrice, setUnitPrice] = useState(centsToYuan(item.unitPriceCents));
  const [commission, setCommission] = useState(percent(item.platformCommissionRateBps));
  const [endAt, setEndAt] = useState(toInputDateTime(item.endAt));
  const [note, setNote] = useState(item.note || "");
  const [reason, setReason] = useState("");

  async function review(action: "APPROVE" | "REJECT") {
    await requestJson(`/api/admin/items/${item.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        reason,
        endAt: fromInputDateTime(endAt),
        unitPriceYuan: Number(unitPrice),
        platformCommissionPercent: Number(commission),
        note,
      }),
    });
    setToast(action === "APPROVE" ? "已审核入账" : "已驳回");
    await onDone();
  }

  return (
    <div className="card item-card">
      <div className="item-meta">
        <div>
          <strong>#{item.order.code}</strong>
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
          <input className="input" type="number" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} />
        </div>
        <div className="field">
          <label>平台抽成%</label>
          <input className="input" type="number" value={commission} onChange={(event) => setCommission(event.target.value)} />
        </div>
      </div>
      <div className="grid two">
        <div className="field">
          <label>备注</label>
          <input className="input" value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
        <div className="field">
          <label>驳回原因</label>
          <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
      </div>
      <div className="toolbar">
        <button className="button" onClick={() => review("APPROVE")}>
          <CheckCircle size={16} />
          通过入账
        </button>
        <button className="button red" onClick={() => review("REJECT")}>
          <XCircle size={16} />
          驳回
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState("review");
  const [toast, setToast] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);

  const players = useMemo(() => dashboard?.users.filter((user) => user.role === "PLAYER") ?? [], [dashboard]);
  const pendingItems = useMemo(
    () => dashboard?.items.filter((item) => item.status === "PENDING_REVIEW" || item.status === "REJECTED") ?? [],
    [dashboard],
  );

  function rangeQuery() {
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  async function load() {
    const me = await requestJson<{ user: AdminUser | null }>("/api/auth/me");
    if (!me.user) {
      window.location.href = "/login";
      return;
    }
    if (me.user.role !== "ADMIN") {
      window.location.href = "/mobile";
      return;
    }
    const data = await requestJson<Dashboard>(`/api/admin/dashboard${rangeQuery()}`);
    setDashboard(data);
    setLoading(false);
  }

  useEffect(() => {
    void load().catch((error) => {
      setToast(error instanceof Error ? error.message : "加载失败");
      setLoading(false);
    });
  }, []);

  async function postForm(event: FormEvent<HTMLFormElement>, url: string, body: Record<string, unknown>) {
    event.preventDefault();
    const form = event.currentTarget;
    await requestJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    form.reset();
    setToast("已保存配置");
    await load();
  }

  if (loading || !dashboard) {
    return <main className="page">加载中...</main>;
  }

  return (
    <main className="app-shell admin-shell">
      <header className="topbar">
        <div className="brand">
          <strong>管理后台</strong>
          <span>流水、审核、结算与配置</span>
        </div>
        <div className="toolbar">
          <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <button className="button secondary" onClick={() => void load()}>
            <RefreshCw size={16} />
            查询
          </button>
          <button className="button amber" onClick={() => (window.location.href = `/api/admin/export${rangeQuery()}`)}>
            <Download size={16} />
            导出
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

      <div className="page admin-page">
        {toast && <div className="toast">{toast}</div>}
        <section className="stats">
          <Stat label="已审核流水" value={centsToYuan(dashboard.totals.grossAmountCents)} />
          <Stat label="未收款" value={centsToYuan(dashboard.totals.unpaidAmountCents)} />
          <Stat label="待发薪" value={centsToYuan(dashboard.totals.unpaidPayrollCents)} />
          <Stat label="平台净收入" value={centsToYuan(dashboard.totals.platformNetCents)} />
        </section>

        <nav className="tabs">
          {[
            ["review", "审核流水"],
            ["payroll", "员工周结"],
            ["customers", "老板消费"],
            ["config", "配置"],
          ].map(([value, label]) => (
            <button key={value} className={`tab ${tab === value ? "active" : ""}`} onClick={() => setTab(value)}>
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
              pendingItems.map((item) => <ReviewControls key={item.id} item={item} onDone={load} setToast={setToast} />)
            )}

            <div className="section-title">
              <h2>流水</h2>
              <span className="muted">{dashboard.items.length} 条</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>单号</th>
                    <th>老板</th>
                    <th>陪玩</th>
                    <th>时间</th>
                    <th>金额</th>
                    <th>状态</th>
                    <th>收款</th>
                    <th>发薪</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.items.map((item) => (
                    <tr key={item.id}>
                      <td>#{item.order.code}</td>
                      <td>{item.order.customer.name}</td>
                      <td>{item.player.displayName}</td>
                      <td>
                        {formatDateTime(item.startAt)}
                        <br />
                        {formatDateTime(item.endAt)}
                      </td>
                      <td>
                        总价 {centsToYuan(item.grossAmountCents)}
                        <br />
                        酬劳 {centsToYuan(item.playerPayoutCents)}
                        <br />
                        时长 {item.billableMinutes ? billableHoursLabel(item.billableMinutes) : "-"}
                      </td>
                      <td>{statusBadge(item.status)}</td>
                      <td>
                        <button
                          className={`button ${item.order.paymentStatus === "PAID" ? "secondary" : "amber"}`}
                          onClick={async () => {
                            await requestJson(`/api/admin/orders/${item.order.id}/payment`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ paid: item.order.paymentStatus !== "PAID" }),
                            });
                            await load();
                          }}
                        >
                          {item.order.paymentStatus === "PAID" ? "已收" : "未收"}
                        </button>
                      </td>
                      <td>
                        <button
                          className={`button ${item.payrollStatus === "PAID" ? "secondary" : "blue"}`}
                          onClick={async () => {
                            await requestJson(`/api/admin/items/${item.id}/payroll`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ paid: item.payrollStatus !== "PAID" }),
                            });
                            await load();
                          }}
                        >
                          {item.payrollStatus === "PAID" ? "已发" : "未发"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "payroll" && (
          <section className="grid two">
            <div className="panel">
              <div className="section-title">
                <h2>员工酬劳</h2>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>陪玩</th>
                      <th>单数</th>
                      <th>应发</th>
                      <th>未发</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.payrollByPlayer.map((row) => (
                      <tr key={row.playerId}>
                        <td>{row.playerName}</td>
                        <td>{row.count}</td>
                        <td>{centsToYuan(row.amountCents)}</td>
                        <td>{centsToYuan(row.unpaidCents || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <div className="section-title">
                <h2>归属提成</h2>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>归属人</th>
                      <th>单数</th>
                      <th>提成</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.ownerCommissionByPlayer.map((row) => (
                      <tr key={row.playerId}>
                        <td>{row.playerName}</td>
                        <td>{row.count}</td>
                        <td>{centsToYuan(row.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {tab === "customers" && (
          <section className="grid">
            <div className="section-title">
              <h2>老板消费</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>老板</th>
                    <th>单数</th>
                    <th>已审核消费</th>
                    <th>未收款</th>
                    <th>档案状态</th>
                    <th>归属人</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.spendByCustomer.map((row) => {
                    const customer = dashboard.customers.find((candidate) => candidate.id === row.customerId);
                    return (
                      <tr key={row.customerId}>
                        <td>{row.customerName}</td>
                        <td>{row.count}</td>
                        <td>{centsToYuan(row.amountCents)}</td>
                        <td>{centsToYuan(row.unpaidCents || 0)}</td>
                        <td>{customer?.status === "CONFIRMED" ? <span className="badge green">已确认</span> : <span className="badge amber">待确认</span>}</td>
                        <td>{customer?.owner?.displayName || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "config" && (
          <section className="grid two">
            <form
              className="panel form"
              onSubmit={(event) => {
                const data = new FormData(event.currentTarget);
                void postForm(event, "/api/admin/users", {
                  username: String(data.get("username") || ""),
                  displayName: String(data.get("displayName") || ""),
                  password: String(data.get("password") || ""),
                  role: data.get("role"),
                });
              }}
            >
              <div className="section-title">
                <h2>新增账号</h2>
                <UserPlus size={18} />
              </div>
              <input className="input" name="username" placeholder="账号" />
              <input className="input" name="displayName" placeholder="显示名" />
              <input className="input" name="password" placeholder="初始密码" />
              <select className="select" name="role" defaultValue="PLAYER">
                <option value="PLAYER">陪玩</option>
                <option value="ADMIN">管理员</option>
              </select>
              <button className="button">保存账号</button>
            </form>

            <form
              className="panel form"
              onSubmit={(event) => {
                const data = new FormData(event.currentTarget);
                void postForm(event, "/api/admin/categories", {
                  name: String(data.get("name") || ""),
                  unitPriceYuan: Number(data.get("unitPriceYuan") || 0),
                  platformCommissionPercent: Number(data.get("platformCommissionPercent") || 0),
                  active: true,
                });
              }}
            >
              <div className="section-title">
                <h2>品类规则</h2>
                <Settings size={18} />
              </div>
              <input className="input" name="name" placeholder="品类名称" />
              <input className="input" type="number" name="unitPriceYuan" placeholder="默认单价/小时" />
              <input className="input" type="number" name="platformCommissionPercent" placeholder="平台抽成%" />
              <button className="button">保存品类</button>
            </form>

            <form
              className="panel form"
              onSubmit={(event) => {
                const data = new FormData(event.currentTarget);
                void postForm(event, "/api/admin/customers", {
                  name: String(data.get("name") || ""),
                  wechat: String(data.get("wechat") || ""),
                  note: String(data.get("note") || ""),
                  ownerId: data.get("ownerId") || null,
                  aliases: String(data.get("aliases") || "")
                    .split(/[,\s，]+/)
                    .filter(Boolean),
                });
              }}
            >
              <div className="section-title">
                <h2>老板档案</h2>
                <ShieldCheck size={18} />
              </div>
              <input className="input" name="name" placeholder="老板名称" />
              <input className="input" name="wechat" placeholder="微信/联系方式" />
              <select className="select" name="ownerId" defaultValue="">
                <option value="">无归属人</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.displayName}
                  </option>
                ))}
              </select>
              <input className="input" name="aliases" placeholder="别名，逗号分隔" />
              <input className="input" name="note" placeholder="备注" />
              <button className="button">保存老板</button>
            </form>

            <form
              className="panel form"
              onSubmit={(event) => {
                const data = new FormData(event.currentTarget);
                void postForm(event, "/api/admin/overrides", {
                  playerId: data.get("playerId"),
                  categoryId: data.get("categoryId"),
                  unitPriceYuan: data.get("unitPriceYuan") ? Number(data.get("unitPriceYuan")) : null,
                  platformCommissionPercent: data.get("platformCommissionPercent")
                    ? Number(data.get("platformCommissionPercent"))
                    : null,
                });
              }}
            >
              <div className="section-title">
                <h2>员工覆盖规则</h2>
              </div>
              <select className="select" name="playerId">
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.displayName}
                  </option>
                ))}
              </select>
              <select className="select" name="categoryId">
                {dashboard.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input className="input" type="number" name="unitPriceYuan" placeholder="覆盖单价，可留空" />
              <input className="input" type="number" name="platformCommissionPercent" placeholder="覆盖抽成%，可留空" />
              <button className="button">保存覆盖</button>
            </form>

            <form
              className="panel form"
              onSubmit={(event) => {
                const data = new FormData(event.currentTarget);
                void postForm(event, "/api/admin/settings", {
                  ownerCommissionPercent: Number(data.get("ownerCommissionPercent") || 0),
                });
              }}
            >
              <div className="section-title">
                <h2>归属提成</h2>
              </div>
              <input className="input" type="number" name="ownerCommissionPercent" placeholder="归属提成占平台抽成%" />
              <button className="button">保存比例</button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
