<div align="center">

# packages-notifier

**Watch npm packages. Get emailed when they update.**

关注 npm 包，版本更新即刻邮件通知。

FastAPI + fastmcp backend · React + Motion frontend · single port · MCP server at `/mcp`

</div>

---

## Features / 功能

**English**

- 🔔 **Update alerts** — poll the npm registry (`registry.npmjs.org`) for every watched package; when `dist-tags.latest` moves, all verified subscribers get an email.
- ✉️ **Email-verified flows** — subscribe, unsubscribe and package watching all require a 6-digit email verification code. No accounts, no passwords.
- 🔌 **MCP server** — the full API is exposed as MCP tools on the same port at `/mcp` (streamable HTTP), so AI agents can subscribe and query on your behalf.
- 🛠 **Admin console** — `/admin` page (Bearer-token protected) to configure SMTP, polling interval, registry URLs, verification TTL and rate limits. Changes apply immediately and persist to `data/config.json`.
- 📱 **Mobile-first UI** — React + Motion, dark/light theme toggle, i18n (English / 简体中文), responsive from 320px up.
- 📡 **Changes feed aware** — integrates with `https://replicate.npmjs.com/registry/_changes` for registry-wide change discovery.

**中文**

- 🔔 **更新通知** — 定期轮询 npm registry；`dist-tags.latest` 变化即邮件通知所有已验证订阅者。
- ✉️ **邮箱验证** — 订阅、取消订阅、关注新包均需 6 位邮箱验证码，无需注册账号。
- 🔌 **MCP 服务** — 全部 API 以 MCP tools 形式挂载在同端口 `/mcp`（streamable HTTP），AI 智能体可代你订阅与查询。
- 🛠 **管理后台** — `/admin` 页面（Bearer Token 保护），可配置 SMTP、轮询间隔、registry 地址、验证码有效期与频控，改动即时生效并持久化。
- 📱 **移动端优先** — React + Motion 动画，深/浅主题切换，中英双语 i18n，320px 起全响应式。

## Quick start / 快速开始

### Backend / 后端

```bash
cd backend
uv sync

# dev mode (no SMTP configured): verification codes are returned in the API response
uv run python run.py
# → http://localhost:8800  (API + /mcp + built frontend)

# with email / 配置邮件后：
#   web UI → /admin → SMTP section, or environment variables:
export PN_SMTP_HOST=smtp.gmail.com
export PN_SMTP_PORT=465
export PN_SMTP_USER=you@gmail.com
export PN_SMTP_PASS="app password"
export PN_SMTP_FROM=you@gmail.com
export PN_ADMIN_TOKEN=your-secret-admin-token
uv run python run.py
```

### Frontend / 前端

```bash
cd frontend
npm install
npm run dev      # dev server on :5173, proxies /api /admin /mcp → :8800
npm run build    # outputs dist/ — served automatically by the backend
```

The backend serves the built frontend automatically if `frontend/dist` exists.
后端会自动托管 `frontend/dist` 构建产物。

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/packages` | Watched packages / 关注中的包 |
| GET | `/api/packages/{name}` | Live npm metadata / 实时包元数据 |
| POST | `/api/subscribe/request-code` | `{email, package}` → send code / 发验证码 |
| POST | `/api/subscribe/verify` | `{email, package, code}` → subscribe / 验证并订阅 |
| POST | `/api/unsubscribe/request-code` | `{email, package}` → send code |
| POST | `/api/unsubscribe/verify` | `{email, package, code}` → unsubscribe |
| GET | `/api/subscriptions?email=` | List subscriptions / 查询订阅 |
| GET / PUT | `/admin/config` | Admin config (Bearer token) / 管理配置 |

### MCP tools / MCP 工具

`health` · `list_watched_packages` · `get_package_info` · `request_subscription_code` · `verify_subscription` · `request_unsubscribe_code` · `verify_unsubscribe` · `list_subscriptions` · `check_updates_now`

```json
{
  "mcpServers": {
    "packages-notifier": { "url": "http://localhost:8800/mcp" }
  }
}
```

## Configuration / 配置

All settings live in `backend/data/config.json` (created on first run, editable via `/admin` or env).
所有配置在 `backend/data/config.json`（首次运行生成，可通过 `/admin` 或环境变量修改）。

| Env | Meaning / 含义 |
|---|---|
| `PN_SMTP_HOST/PORT/USER/PASS/FROM` | SMTP for sending emails / 发信 SMTP |
| `PN_ADMIN_TOKEN` | Admin API token / 管理令牌 |
| `PN_BASE_URL` | Public base URL / 站点地址 |

## Deployment with cloudflared / cloudflared 穿透部署

```bash
# 1. start the app / 启动应用 (port 8800)
# 2. create a tunnel / 创建隧道
cloudflared tunnel create packages-notifier
# 3. install as a service / 安装为服务
cloudflared service install
# 4. route your domain / 绑定域名
cloudflared tunnel route dns packages-notifier notifier.example.com
# 5. config at ~/.cloudflared/config.yml — see cloudflared/config.example.yml
```

See [`cloudflared/config.example.yml`](cloudflared/config.example.yml).

## Project structure / 项目结构

```
packages-notifier/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, mounts MCP + static SPA
│   │   ├── api.py           # REST + admin routes
│   │   ├── mcp_server.py    # fastmcp tools (same port /mcp)
│   │   ├── registry.py      # npm registry client + poller
│   │   ├── email_sender.py  # SMTP (aiosmtplib)
│   │   ├── notify.py        # update notification dispatch
│   │   ├── db.py            # SQLite (WAL)
│   │   └── config.py        # config.json + env
│   └── run.py
├── frontend/
│   └── src/
│       ├── pages/           # Home · Query · Subscribe · Unsubscribe · Subscriptions · Admin
│       ├── i18n.ts          # EN / 中文
│       ├── motion-bits.tsx  # Motion animation primitives
│       └── api.ts
└── cloudflared/
    └── config.example.yml
```

## License

[MIT](LICENSE)
