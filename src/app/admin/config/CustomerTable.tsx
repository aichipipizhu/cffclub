"use client";

import { RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ToastApi } from "@/app/_components/feedback";
import { requestJson } from "@/lib/clientHttp";
import type { CustomerDto, UserDto } from "@/lib/types";

import { nullableText, parseAliases } from "./utils";

type CustomerRow = {
  rowId: string;
  id?: string;
  name: string;
  wechat: string;
  status: "PENDING" | "CONFIRMED";
  ownerId: string;
  aliases: string;
  note: string;
  dirty: boolean;
};

function aliasesText(customer: CustomerDto) {
  return (customer.aliases ?? []).map((alias) => alias.alias).join("，");
}

function rowsFromCustomers(customers: CustomerDto[]): CustomerRow[] {
  return customers.map((customer) => ({
    rowId: customer.id,
    id: customer.id,
    name: customer.name,
    wechat: customer.wechat || "",
    status: customer.status,
    ownerId: customer.ownerId || "",
    aliases: aliasesText(customer),
    note: customer.note || "",
    dirty: false,
  }));
}

export function CustomerTable({
  customers,
  players,
  onSaved,
  toast,
}: {
  customers: CustomerDto[];
  players: UserDto[];
  onSaved: () => Promise<void>;
  toast: ToastApi;
}) {
  const [rows, setRows] = useState<CustomerRow[]>(() => rowsFromCustomers(customers));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setRows(rowsFromCustomers(customers)), [customers]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => `${row.name} ${row.wechat} ${row.aliases}`.toLowerCase().includes(keyword));
  }, [query, rows]);

  function updateRow(rowId: string, patch: Partial<CustomerRow>) {
    setRows((current) => current.map((row) => (row.rowId === rowId ? { ...row, ...patch, dirty: true } : row)));
  }

  function addDraft() {
    setRows((current) => [
      {
        rowId: `new:${Date.now()}`,
        name: "",
        wechat: "",
        status: "CONFIRMED",
        ownerId: "",
        aliases: "",
        note: "",
        dirty: true,
      },
      ...current,
    ]);
  }

  async function save() {
    const dirtyRows = rows.filter((row) => row.dirty);
    const items = [];
    setError("");
    for (const row of dirtyRows) {
      if (!row.name.trim()) {
        setError("请填写老板名称");
        return;
      }
      items.push({
        id: row.id,
        name: row.name.trim(),
        wechat: nullableText(row.wechat),
        note: nullableText(row.note),
        ownerId: row.ownerId || null,
        status: row.status,
        aliases: parseAliases(row.aliases),
      });
    }

    setSaving(true);
    try {
      await requestJson("/api/admin/customers/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      toast.success("已保存老板档案");
      await onSaved();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const dirtyCount = rows.filter((row) => row.dirty).length;

  return (
    <section className="panel config-section">
      <div className="section-title">
        <div>
          <h2>老板档案</h2>
          <span className="muted">{dirtyCount ? `${dirtyCount} 行未保存` : "维护老板信息、归属和别名"}</span>
        </div>
        <div className="toolbar config-title-tools">
          <input className="input config-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索老板/微信/别名" />
          <button className="button secondary" type="button" onClick={addDraft}>新增老板</button>
        </div>
      </div>
      <div className="table-wrap config-table-wrap">
        <table className="config-table customer-config-table">
          <thead>
            <tr>
              <th>老板名称</th>
              <th>微信</th>
              <th>状态</th>
              <th>归属人</th>
              <th>别名</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.rowId} className={row.dirty ? "dirty-row" : ""}>
                <td><input className="input" value={row.name} onChange={(event) => updateRow(row.rowId, { name: event.target.value })} /></td>
                <td><input className="input" value={row.wechat} onChange={(event) => updateRow(row.rowId, { wechat: event.target.value })} /></td>
                <td>
                  <select className="select" value={row.status} onChange={(event) => updateRow(row.rowId, { status: event.target.value as CustomerRow["status"] })}>
                    <option value="CONFIRMED">已确认</option>
                    <option value="PENDING">待确认</option>
                  </select>
                </td>
                <td>
                  <select className="select" value={row.ownerId} onChange={(event) => updateRow(row.rowId, { ownerId: event.target.value })}>
                    <option value="">无归属人</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>{player.displayName}</option>
                    ))}
                  </select>
                </td>
                <td><input className="input" value={row.aliases} onChange={(event) => updateRow(row.rowId, { aliases: event.target.value })} /></td>
                <td><input className="input" value={row.note} onChange={(event) => updateRow(row.rowId, { note: event.target.value })} /></td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td className="table-empty" colSpan={6}>没有匹配的老板档案</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && <div className="field-error">{error}</div>}
      <div className="dirty-toolbar">
        <span className="muted">{dirtyCount ? `未保存 ${dirtyCount} 行` : "暂无未保存修改"}</span>
        <div className="toolbar">
          <button className="button secondary" type="button" disabled={!dirtyCount || saving} onClick={() => setRows(rowsFromCustomers(customers))}>
            <RotateCcw size={16} />
            撤销
          </button>
          <button className="button" type="button" disabled={!dirtyCount || saving} onClick={() => void save()}>
            <Save size={16} />
            {saving ? "保存中" : "保存老板"}
          </button>
        </div>
      </div>
    </section>
  );
}

