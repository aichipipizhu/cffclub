"use client";

import { Eye, EyeOff, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";

import type { ToastApi } from "@/app/_components/feedback";
import { requestJson } from "@/lib/clientHttp";

function field(data: FormData, key: string) {
  return String(data.get(key) || "").trim();
}

export function AccountCreateForm({
  onSaved,
  toast,
}: {
  onSaved: () => Promise<void>;
  toast: ToastApi;
}) {
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!field(data, "username") || !field(data, "displayName") || !field(data, "password")) {
      setError("账号、显示名和初始密码都需要填写");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await requestJson("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: field(data, "username"),
          displayName: field(data, "displayName"),
          password: field(data, "password"),
          role: data.get("role"),
        }),
      });
      form.reset();
      toast.success("已保存账号");
      await onSaved();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form config-section" onSubmit={(event) => void submit(event)}>
      <div className="section-title">
        <h2>新增账号</h2>
        <UserPlus size={18} />
      </div>
      <input className="input" name="username" placeholder="账号" />
      <input className="input" name="displayName" placeholder="显示名" />
      <div className="input-with-action">
        <input className="input" type={showPassword ? "text" : "password"} name="password" placeholder="初始密码" />
        <button className="button secondary" type="button" onClick={() => setShowPassword((current) => !current)}>
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          {showPassword ? "隐藏" : "显示"}
        </button>
      </div>
      <select className="select" name="role" defaultValue="PLAYER">
        <option value="PLAYER">陪玩</option>
        <option value="ADMIN">管理员</option>
      </select>
      {error && <div className="field-error">{error}</div>}
      <button className="button" type="submit" disabled={saving}>
        {saving ? "保存中" : "保存账号"}
      </button>
    </form>
  );
}

