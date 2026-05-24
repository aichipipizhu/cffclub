"use client";

import { LogIn, Sparkles, UserPlus } from "lucide-react";
import { useState } from "react";

type AuthUser = { role: "ADMIN" | "PLAYER" };

async function login(username: string, password: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const payload = (await response.json()) as { user?: AuthUser; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "登录失败");
  }
  return payload.user;
}

async function register(username: string, displayName: string, password: string) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, displayName, password }),
  });
  const payload = (await response.json()) as { user?: AuthUser; error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "注册失败");
  }
  return payload.user;
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isRegister = mode === "register";

  return (
    <main className="login-wrap">
      <section className="login-hero" aria-label="系统介绍">
        <div className="brand-mark">
          <Sparkles size={16} />
          Gemini light workspace
        </div>
        <h1>陪玩报备报单系统</h1>
        <p>把开局报备、审核入账、员工周结和老板消费统计收进一个清爽的工作台，移动端快速录入，后台高效核对。</p>
        <div className="login-highlights">
          <span>H5 报备</span>
          <span>审核流水</span>
          <span>薪资统计</span>
        </div>
      </section>
      <section className="panel login-card">
        <div className="section-title">
          <div>
            <h2>陪玩报备报单系统</h2>
            <p className="muted">{isRegister ? "注册陪玩账号" : "账号密码登录"}</p>
          </div>
        </div>
        {error && <div className="toast">{error}</div>}
        <form
          className="form"
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading(true);
            setError("");
            try {
              if (isRegister && password !== confirmPassword) {
                throw new Error("两次输入的密码不一致");
              }
              const user = isRegister
                ? await register(username, displayName, password)
                : await login(username, password);
              window.location.href = user?.role === "ADMIN" ? "/admin" : "/mobile";
            } catch (loginError) {
              setError(loginError instanceof Error ? loginError.message : isRegister ? "注册失败" : "登录失败");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="field">
            <label htmlFor="username">账号</label>
            <input id="username" className="input" value={username} onChange={(event) => setUsername(event.target.value)} />
            {isRegister && <span className="muted">3-32位英文、数字、下划线；提交后统一转小写</span>}
          </div>
          {isRegister && (
            <div className="field">
              <label htmlFor="displayName">昵称</label>
              <input
                id="displayName"
                className="input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {isRegister && (
            <div className="field">
              <label htmlFor="confirmPassword">确认密码</label>
              <input
                id="confirmPassword"
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          )}
          <button className="button" type="submit" disabled={loading}>
            {isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
            {loading ? (isRegister ? "注册中" : "登录中") : isRegister ? "注册并进入陪玩端" : "登录"}
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError("");
              setUsername(isRegister ? "admin" : "");
              setPassword(isRegister ? "admin123" : "");
              setDisplayName("");
              setConfirmPassword("");
            }}
          >
            {isRegister ? "已有账号，返回登录" : "没有账号，立即注册"}
          </button>
        </form>
      </section>
    </main>
  );
}
