"use client";

import { RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ToastApi } from "@/app/_components/feedback";
import { validatePercentInput } from "@/lib/clientInput";
import { requestJson } from "@/lib/clientHttp";
import type { CategoryDto } from "@/lib/types";

import { percentText } from "./utils";

type CategoryRow = {
  rowId: string;
  id?: string;
  name: string;
  platformCommissionPercent: string;
  active: boolean;
  dirty: boolean;
};

function rowsFromCategories(categories: CategoryDto[]): CategoryRow[] {
  return categories.map((category) => ({
    rowId: category.id,
    id: category.id,
    name: category.name,
    platformCommissionPercent: percentText(category.platformCommissionRateBps),
    active: category.active ?? true,
    dirty: false,
  }));
}

export function CategoryTable({
  categories,
  onSaved,
  toast,
}: {
  categories: CategoryDto[];
  onSaved: () => Promise<void>;
  toast: ToastApi;
}) {
  const [rows, setRows] = useState<CategoryRow[]>(() => rowsFromCategories(categories));
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newCommission, setNewCommission] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setRows(rowsFromCategories(categories)), [categories]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return keyword ? rows.filter((row) => row.name.toLowerCase().includes(keyword)) : rows;
  }, [query, rows]);

  function updateRow(rowId: string, patch: Partial<CategoryRow>) {
    setRows((current) => current.map((row) => (row.rowId === rowId ? { ...row, ...patch, dirty: true } : row)));
  }

  function addDraft() {
    const name = newName.trim();
    if (!name) {
      setError("请填写品类名称");
      return;
    }
    const commission = validatePercentInput(newCommission, "平台抽成", { required: true });
    if (!commission.ok) {
      setError(commission.message);
      return;
    }
    setRows((current) => [
      {
        rowId: `new:${Date.now()}`,
        name,
        platformCommissionPercent: newCommission.trim(),
        active: true,
        dirty: true,
      },
      ...current,
    ]);
    setNewName("");
    setNewCommission("");
    setError("");
  }

  async function save() {
    const dirtyRows = rows.filter((row) => row.dirty);
    const items = [];
    setError("");
    for (const row of dirtyRows) {
      if (!row.name.trim()) {
        setError("请填写品类名称");
        return;
      }
      const commission = validatePercentInput(row.platformCommissionPercent, "平台抽成", { required: true });
      if (!commission.ok) {
        setError(commission.message);
        return;
      }
      items.push({
        id: row.id,
        name: row.name.trim(),
        platformCommissionPercent: commission.value,
        active: row.active,
      });
    }

    setSaving(true);
    try {
      await requestJson("/api/admin/categories/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      toast.success("已保存品类规则");
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
          <h2>品类规则</h2>
          <span className="muted">{dirtyCount ? `${dirtyCount} 行未保存` : "维护默认平台抽成和启用状态"}</span>
        </div>
        <input className="input config-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索品类" />
      </div>
      <div className="table-wrap config-table-wrap">
        <table className="config-table">
          <thead>
            <tr>
              <th>品类名称</th>
              <th>默认抽成%</th>
              <th>启用</th>
            </tr>
          </thead>
          <tbody>
            <tr className="config-new-row">
              <td><input className="input" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="新增品类" /></td>
              <td><input className="input" inputMode="decimal" value={newCommission} onChange={(event) => setNewCommission(event.target.value)} placeholder="抽成%" /></td>
              <td><button className="button secondary" type="button" onClick={addDraft}>加入待保存</button></td>
            </tr>
            {filteredRows.map((row) => (
              <tr key={row.rowId} className={row.dirty ? "dirty-row" : ""}>
                <td><input className="input" value={row.name} onChange={(event) => updateRow(row.rowId, { name: event.target.value })} /></td>
                <td>
                  <input
                    className="input"
                    inputMode="decimal"
                    pattern="[0-9]+(\\.[0-9]{1,2})?"
                    value={row.platformCommissionPercent}
                    onChange={(event) => updateRow(row.rowId, { platformCommissionPercent: event.target.value })}
                  />
                </td>
                <td>
                  <label className="switch-row">
                    <input type="checkbox" checked={row.active} onChange={(event) => updateRow(row.rowId, { active: event.target.checked })} />
                    <span>{row.active ? "启用" : "停用"}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <div className="field-error">{error}</div>}
      <div className="dirty-toolbar">
        <span className="muted">{dirtyCount ? `未保存 ${dirtyCount} 行` : "暂无未保存修改"}</span>
        <div className="toolbar">
          <button className="button secondary" type="button" disabled={!dirtyCount || saving} onClick={() => setRows(rowsFromCategories(categories))}>
            <RotateCcw size={16} />
            撤销
          </button>
          <button className="button" type="button" disabled={!dirtyCount || saving} onClick={() => void save()}>
            <Save size={16} />
            {saving ? "保存中" : "保存品类"}
          </button>
        </div>
      </div>
    </section>
  );
}

