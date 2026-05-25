"use client";

import { Eye, EyeOff, Settings, ShieldCheck, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";

import type { ToastApi } from "@/app/_components/feedback";
import { validatePercentInput } from "@/lib/clientInput";
import { requestJson } from "@/lib/clientHttp";
import type { DashboardDto, UserDto } from "@/lib/types";

type FormErrors = Record<string, string>;

function textValue(data: FormData, key: string) {
  return String(data.get(key) || "").trim();
}

function FieldError({ errors, name }: { errors: FormErrors; name: string }) {
  return errors[name] ? <span className="field-error">{errors[name]}</span> : null;
}

export function ConfigForms({
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
  const [saving, setSaving] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  async function submitForm(event: FormEvent<HTMLFormElement>, formKey: string, url: string, body: Record<string, unknown>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(formKey);
    setErrors({});
    try {
      await requestJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      form.reset();
      toast.success("已保存配置");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving("");
    }
  }

  return (
    <section className="grid two">
      <form
        className="panel form"
        onSubmit={(event) => {
          const data = new FormData(event.currentTarget);
          const nextErrors: FormErrors = {};
          if (!textValue(data, "username")) nextErrors.username = "请填写账号";
          if (!textValue(data, "displayName")) nextErrors.displayName = "请填写显示名";
          if (!textValue(data, "password")) nextErrors.password = "请填写初始密码";
          if (Object.keys(nextErrors).length) {
            event.preventDefault();
            setErrors(nextErrors);
            return;
          }
          void submitForm(event, "user", "/api/admin/users", {
            username: textValue(data, "username"),
            displayName: textValue(data, "displayName"),
            password: textValue(data, "password"),
            role: data.get("role"),
          });
        }}
      >
        <div className="section-title">
          <h2>新增账号</h2>
          <UserPlus size={18} />
        </div>
        <input className="input" name="username" placeholder="账号" />
        <FieldError errors={errors} name="username" />
        <input className="input" name="displayName" placeholder="显示名" />
        <FieldError errors={errors} name="displayName" />
        <div className="input-with-action">
          <input className="input" type={showPassword ? "text" : "password"} name="password" placeholder="初始密码" />
          <button className="button secondary" type="button" onClick={() => setShowPassword((current) => !current)}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            {showPassword ? "隐藏" : "显示"}
          </button>
        </div>
        <FieldError errors={errors} name="password" />
        <select className="select" name="role" defaultValue="PLAYER">
          <option value="PLAYER">陪玩</option>
          <option value="ADMIN">管理员</option>
        </select>
        <button className="button" type="submit" disabled={saving === "user"}>
          {saving === "user" ? "保存中" : "保存账号"}
        </button>
      </form>

      <form
        className="panel form"
        onSubmit={(event) => {
          const data = new FormData(event.currentTarget);
          const nextErrors: FormErrors = {};
          const commission = validatePercentInput(textValue(data, "platformCommissionPercent"), "平台抽成", { required: true });
          if (!textValue(data, "name")) nextErrors.categoryName = "请填写品类名称";
          if (!commission.ok) nextErrors.categoryCommission = commission.message;
          if (Object.keys(nextErrors).length) {
            event.preventDefault();
            setErrors(nextErrors);
            return;
          }
          if (!commission.ok) return;
          void submitForm(event, "category", "/api/admin/categories", {
            name: textValue(data, "name"),
            platformCommissionPercent: commission.value,
            active: true,
          });
        }}
      >
        <div className="section-title">
          <h2>品类规则</h2>
          <Settings size={18} />
        </div>
        <input className="input" name="name" placeholder="品类名称" />
        <FieldError errors={errors} name="categoryName" />
        <input className="input" inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" name="platformCommissionPercent" placeholder="平台抽成%" />
        <FieldError errors={errors} name="categoryCommission" />
        <button className="button" type="submit" disabled={saving === "category"}>
          {saving === "category" ? "保存中" : "保存品类"}
        </button>
      </form>

      <form
        className="panel form"
        onSubmit={(event) => {
          const data = new FormData(event.currentTarget);
          if (!textValue(data, "name")) {
            event.preventDefault();
            setErrors({ customerName: "请填写老板名称" });
            return;
          }
          void submitForm(event, "customer", "/api/admin/customers", {
            name: textValue(data, "name"),
            wechat: textValue(data, "wechat"),
            note: textValue(data, "note"),
            ownerId: data.get("ownerId") || null,
            aliases: textValue(data, "aliases").split(/[,\s，]+/).filter(Boolean),
          });
        }}
      >
        <div className="section-title">
          <h2>老板档案</h2>
          <ShieldCheck size={18} />
        </div>
        <input className="input" name="name" placeholder="老板名称" />
        <FieldError errors={errors} name="customerName" />
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
        <button className="button" type="submit" disabled={saving === "customer"}>
          {saving === "customer" ? "保存中" : "保存老板"}
        </button>
      </form>

      <form
        className="panel form"
        onSubmit={(event) => {
          const data = new FormData(event.currentTarget);
          const percentText = textValue(data, "platformCommissionPercent");
          const commission = percentText ? validatePercentInput(percentText, "覆盖抽成", { required: true }) : { ok: true as const, value: null };
          if (!commission.ok) {
            event.preventDefault();
            setErrors({ overrideCommission: commission.message });
            return;
          }
          void submitForm(event, "override", "/api/admin/overrides", {
            playerId: data.get("playerId"),
            categoryId: data.get("categoryId"),
            platformCommissionPercent: commission.value,
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
        <input className="input" inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" name="platformCommissionPercent" placeholder="覆盖抽成%，可留空" />
        <FieldError errors={errors} name="overrideCommission" />
        <button className="button" type="submit" disabled={saving === "override"}>
          {saving === "override" ? "保存中" : "保存覆盖"}
        </button>
      </form>

      <form
        className="panel form"
        onSubmit={(event) => {
          const data = new FormData(event.currentTarget);
          const commission = validatePercentInput(textValue(data, "ownerCommissionPercent"), "归属提成", { required: true });
          if (!commission.ok) {
            event.preventDefault();
            setErrors({ ownerCommission: commission.message });
            return;
          }
          const ownerCommissionPercent = commission.value;
          void submitForm(event, "settings", "/api/admin/settings", {
            ownerCommissionPercent,
          });
        }}
      >
        <div className="section-title">
          <h2>归属提成</h2>
        </div>
        <input className="input" inputMode="decimal" pattern="[0-9]+(\\.[0-9]{1,2})?" name="ownerCommissionPercent" placeholder="归属提成占平台抽成%" />
        <FieldError errors={errors} name="ownerCommission" />
        <button className="button" type="submit" disabled={saving === "settings"}>
          {saving === "settings" ? "保存中" : "保存比例"}
        </button>
      </form>
    </section>
  );
}
