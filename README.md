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

## Windows 服务器一键部署

服务器需要先准备好 Git、Node.js 20/22 LTS，以及可连接的 MySQL 数据库。首次部署可以在服务器 PowerShell 中运行：

```powershell
New-Item C:\deploy -ItemType Directory -Force
Invoke-WebRequest https://raw.githubusercontent.com/aichipipizhu/cffclub/main/scripts/deploy.ps1 -OutFile C:\deploy\deploy.ps1
powershell -ExecutionPolicy Bypass -File C:\deploy\deploy.ps1 `
  -DatabaseUrl "mysql://用户名:密码@数据库地址:3306/kabuda" `
  -AuthSecret "替换成至少24位的随机密钥" `
  -Seed
```

脚本默认会把项目部署到 `C:\sites\cffclub`，并执行完整生产流程：

```powershell
git clone / git pull
npm ci
npx prisma migrate deploy
npm run build
PM2 启动或重启 kabuda
PM2 开机自启配置
```

后续更新只需要在服务器运行：

```powershell
C:\sites\cffclub\scripts\deploy.ps1
```

如果不是首次初始化数据库，不要再加 `-Seed`。服务器上的 `.env` 不会提交到 Git，必须保留真实的 `DATABASE_URL` 和 `AUTH_SECRET`。

如果 PowerShell 不是管理员权限，脚本仍会部署并启动 PM2，但可能无法完成开机自启配置。需要开机自启时，请用管理员 PowerShell 再运行一次脚本，或先用 `-SkipStartup` 跳过。
