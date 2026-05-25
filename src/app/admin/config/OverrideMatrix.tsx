"use client";

import { RotateCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";

import type { ToastApi } from "@/app/_components/feedback";
import { validatePercentInput } from "@/lib/clientInput";
import { requestJson } from "@/lib/clientHttp";
import type { DashboardDto, UserDto } from "@/lib/types";

import { percentText } from "./utils";

function keyOf(playerId: string, categoryId: string) {
  return `${playerId}:${categoryId}`;
}

export function OverrideMatrix({
  dashboard,
  players,
  onSaved,
  toast,
}: {
  dashboard: DashboardDto;
  players: UserDto[];
  onSaved: () => Promise<void>;
  toast: ToastApi;
}) {
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const overrideMap = useMemo(
    () => new Map(dashboard.pricingOverrides.map((item) => [keyOf(item.playerId, item.categoryId), item.platformCommissionRateBps])),
    [dashboard.pricingOverrides],
  );

  const filteredPlayers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return keyword
      ? players.filter((player) => `${player.displayName} ${player.username || ""}`.toLowerCase().includes(keyword))
      : players;
  }, [players, query]);

  function cellValue(playerId: string, categoryId: string) {
    const key = keyOf(playerId, categoryId);
    return Object.prototype.hasOwnProperty.call(dirty, key) ? dirty[key] : percentText(overrideMap.get(key));
  }

  function setCell(playerId: string, categoryId: string, value: string) {
    setDirty((current) => ({ ...current, [keyOf(playerId, categoryId)]: value }));
  }

  function applyRow(playerId: string, value: string) {
    setDirty((current) => {
      const next = { ...current };
      for (const category of dashboard.categories) next[keyOf(playerId, category.id)] = value;
      return next;
    });
  }

  function applyColumn(categoryId: string, value: string) {
    setDirty((current) => {
      const next = { ...current };
      for (const player of filteredPlayers) next[keyOf(player.id, categoryId)] = value;
      return next;
    });
  }

  function promptValue(target: "行" | "列") {
    const value = window.prompt(`批量设置${target}覆盖抽成%，留空表示清空覆盖`);
    return value === null ? null : value.trim();
  }

  async function save() {
    const items = [];
    setError("");
    for (const [key, value] of Object.entries(dirty)) {
      const [playerId, categoryId] = key.split(":");
      const trimmed = value.trim();
      if (!trimmed) {
        items.push({ playerId, categoryId, platformCommissionPercent: null });
        continue;
      }
      const percent = validatePercentInput(trimmed, "覆盖抽成", { required: true });
      if (!percent.ok) {
        setError(percent.message);
        return;
      }
      items.push({ playerId, categoryId, platformCommissionPercent: percent.value });
    }

    setSaving(true);
    try {
      await requestJson("/api/admin/overrides/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      setDirty({});
      toast.success("已保存员工覆盖抽成");
      await onSaved();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const dirtyCount = Object.keys(dirty).length;

  return (
    <section className="panel config-section">
      <div className="section-title">
        <div>
          <h2>员工覆盖抽成</h2>
          <span className="muted">{dirtyCount ? `${dirtyCount} 条未保存` : "空白表示沿用品类默认抽成"}</span>
        </div>
        <input className="input config-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索陪玩" />
      </div>
      <div className="matrix-wrap">
        <table className="config-matrix">
          <thead>
            <tr>
              <th className="matrix-player-col">陪玩 \ 品类</th>
              {dashboard.categories.map((category) => (
                <th key={category.id}>
                  <div className="matrix-heading">
                    <strong>{category.name}</strong>
                    <small>默认 {percentText(category.platformCommissionRateBps)}%</small>
                    <div className="matrix-actions">
                      <button className="link-button" type="button" onClick={() => {
                        const value = promptValue("列");
                        if (value !== null) applyColumn(category.id, value);
                      }}>
                        设置列
                      </button>
                      <button className="link-button" type="button" onClick={() => applyColumn(category.id, "")}>
                        清空
                      </button>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((player) => (
              <tr key={player.id}>
                <td className="matrix-player-col">
                  <strong>{player.displayName}</strong>
                  <div className="matrix-actions">
                    <button className="link-button" type="button" onClick={() => {
                      const value = promptValue("行");
                      if (value !== null) applyRow(player.id, value);
                    }}>
                      设置行
                    </button>
                    <button className="link-button" type="button" onClick={() => applyRow(player.id, "")}>
                      清空
                    </button>
                  </div>
                </td>
                {dashboard.categories.map((category) => {
                  const key = keyOf(player.id, category.id);
                  return (
                    <td key={category.id} className={Object.prototype.hasOwnProperty.call(dirty, key) ? "dirty-cell" : ""}>
                      <input
                        className="matrix-input"
                        inputMode="decimal"
                        pattern="[0-9]+(\\.[0-9]{1,2})?"
                        value={cellValue(player.id, category.id)}
                        onChange={(event) => setCell(player.id, category.id, event.target.value)}
                        placeholder={`${percentText(category.platformCommissionRateBps)}%`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {filteredPlayers.length === 0 && (
              <tr>
                <td className="table-empty" colSpan={dashboard.categories.length + 1}>没有匹配的陪玩</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && <div className="field-error">{error}</div>}
      <div className="dirty-toolbar">
        <span className="muted">{dirtyCount ? `未保存 ${dirtyCount} 条修改` : "暂无未保存修改"}</span>
        <div className="toolbar">
          <button className="button secondary" type="button" disabled={!dirtyCount || saving} onClick={() => setDirty({})}>
            <RotateCcw size={16} />
            全部撤销
          </button>
          <button className="button" type="button" disabled={!dirtyCount || saving} onClick={() => void save()}>
            <Save size={16} />
            {saving ? "保存中" : "保存覆盖"}
          </button>
        </div>
      </div>
    </section>
  );
}

