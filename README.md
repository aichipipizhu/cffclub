# 陪玩俱乐部报备报单系统

H5 手机报备/报单 + 管理后台 MVP。陪玩开局报备生成单号，结束后提交明细；管理员审核后统计流水、员工酬劳、老板消费和归属提成。

## 本地启动

1. 复制环境变量：

```powershell
Copy-Item .env.example .env
```

2. 修改 `.env` 中的 `DATABASE_URL` 和 `AUTH_SECRET`。
3. 安装依赖并初始化数据库：

```powershell
npm install
npm run prisma:migrate
npm run seed
npm run dev
```

默认种子账号：

- 管理员：`admin` / `admin123`
- 陪玩：`koko` / `player123`
- 陪玩：`xinqing` / `player123`

