"use client";

import { useEffect, useState } from "react";

import type { ToastApi } from "@/app/_components/feedback";
import { validatePercentInput } from "@/lib/clientInput";
import { requestJson } from "@/lib/clientHttp";

export function GlobalSettings({ toast }: { toast: ToastApi }) {
  const [ownerCommissionPercent, setOwnerCommissionPercent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void requestJson<{ ownerCommissionPercent: number }>("/api/admin/settings")
      .then((data) => setOwnerCommissionPercent(String(data.ownerCommissionPercent)))
      .catch(() => setOwnerCommissionPercent(""));
  }, []);

  async function save() {
    const percent = validatePercentInput(ownerCommissionPercent, "归属提成", { required: true });
    if (!percent.ok) {
      setError(percent.message);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await requestJson("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerCommissionPercent: percent.value }),
      });
      toast.success("已保存归属提成");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel config-section">
      <div className="section-title">
        <div>
          <h2>归属提成</h2>
          <span className="muted">按平台抽成比例计算</span>
        </div>
      </div>
      <div className="input-with-action">
        <input
          className="input"
          inputMode="decimal"
          pattern="[0-9]+(\\.[0-9]{1,2})?"
          value={ownerCommissionPercent}
          onChange={(event) => setOwnerCommissionPercent(event.target.value)}
          placeholder="归属提成占平台抽成%"
        />
        <button className="button" type="button" disabled={saving} onClick={() => void save()}>
          {saving ? "保存中" : "保存比例"}
        </button>
      </div>
      {error && <div className="field-error">{error}</div>}
    </section>
  );
}

