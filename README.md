# Creative Production Management Platform — Frontend

React + Vite SPA for an end-to-end creative-agency production lifecycle. Pairs with `../change-art-backend` and consumes the same `@contracts` shapes. Drives the client portal and the internal portal (CS, Team Lead, Designer Jr/Sr, Digitator Jr/Sr, Sewout, QC, Admin).

## Stack (pinned)


| Layer | Tech |
|---|---|
| Build | Vite 5.x |
| Framework | React 18.x (hooks-only) |
| Language | TypeScript 5.6 (strict) |
| Routing | React Router 6.x |
| Styling | Tailwind CSS 3.4 + CSS variables |
| Components | shadcn/ui patterns (Radix-style) + Lucide icons |
| State | Zustand 4 (per-module stores) |
| Server state | TanStack Query 5 |
| Forms | React Hook Form 7 + Zod 3 |
| Real-time | Socket.IO Client 4 |
| File uploads | tus-js-client 4 |
| Charts | Recharts 2 |
| Tables | TanStack Table 8 |
| Notifications | react-hot-toast + Firebase 10 (FCM) |
| Dates | date-fns 3 |
| PWA | vite-plugin-pwa |
| Testing | Vitest + React Testing Library |

Pattern: **Modular by domain** — `src/modules/<name>/` self-contained (`components/`, `hooks/`, `services/`, `stores/`, `types/`, `index.ts`). Inter-module communication via `@contracts` only.

## Project layout

```
.
├── ARCHITECTURE_BLUEPRINT.md   # SSOT (shared with backend, at repo root)
├── prd.md                       # Product spec (shared, at repo root)
├── AGENT_WORKFLOW.md            # Multi-agent operating system (shared, at repo root)
├── FEATURE_SPEC_TEMPLATE.md     # Per-feature spec template (frontend-flavoured)
├── PROGRESS.md                  # Live sprint state — frontend
├── CHANGELOG.md                 # Append-only history — frontend
├── specs/                       # FEATURE-SPEC-F-FE-*.md per feature
├── .claude/agents/              # Frontend subagents (12 invokable agents)
├── public/                      # Static assets, PWA icons, FCM service worker
└── src/
    ├── main.tsx / App.tsx / router.tsx
    ├── contracts/               # Mirrored enums/interfaces/events/error-codes
    ├── lib/                     # api-client, socket-client, fcm, config, utils
    ├── providers/               # Auth, Query, Socket, Theme
    ├── layouts/                 # AuthLayout, DashboardLayout, RoleGuard
    ├── routes/                  # Page-level components, role-grouped folders
    └── modules/
        ├── auth/
        ├── client-portal/
        ├── cs-panel/
        ├── team-lead/
        ├── designer-workspace/
        ├── digitator-workspace/
        ├── sewout-workspace/
        ├── qc-panel/
        ├── admin-panel/
        ├── notifications/
        └── shared-ui/           # JobCardView, FileUploader, StatusBadge, …
```

## Setup

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Fill VITE_API_BASE_URL, VITE_WS_URL, Firebase keys, etc.

# 3. Run (dev)
npm run dev            # http://localhost:5173 — proxies /api and /socket.io to backend

# 4. Production build
npm run build          # type-check + bundle to dist/
npm run preview        # preview the production build locally
```

The dev server proxies `/api/*` and `/socket.io` to `VITE_API_BASE_URL` so Better Auth's HTTP-only session cookies work without CORS workarounds.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check + production bundle |
| `npm run preview` | Preview built bundle |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over `src/` |
| `npm run lint:fix` | ESLint autofix |
| `npm run format` | Prettier write |
| `npm test` | Vitest (run once) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest + V8 coverage |

## Conventions

- File names: PascalCase for components (`JobCardView.tsx`), kebab-case for non-component modules (`api-client.ts`)
- Interfaces: `IPascalCase` (e.g. `IJobCard`) — imported from `@contracts`, never redefined locally
- Enums: PascalCase — imported from `@contracts/enums`
- Hooks: `useX` (e.g. `useJobCards`)
- Zustand stores: `useXStore` (e.g. `useAuthStore`)
- Error codes: SCREAMING_SNAKE_CASE from `@contracts/error-codes`
- API envelope (mirrored from backend): `{ success, data, meta?, timestamp }` / `{ success: false, error: { code, message, details? }, timestamp }`
- No `process.env` in business logic — use `@lib/config`
- No `console.log` — use the toast system for user-visible messages, drop or use `console.warn/error` for diagnostics only

## Auth model

Backend uses **Better Auth** with HTTP-only session cookies on `/api/auth/*`. The frontend:

1. Posts to `/api/auth/sign-in/email` with `withCredentials: true` (axios)
2. Reads the current session via `GET /api/auth/session`
3. Never touches the cookie directly — `js-cookie`-style storage is forbidden
4. Reflects the session in `useAuthStore` for app-wide role gating

`RoleGuard` redirects users to their canonical role dashboard if they hit a route outside their permission set.

## Real-time

`SocketProvider` connects to `/socket.io` (cookie-authenticated) and dispatches `job-status-changed`, `job-assigned`, `notification-new`, etc., into TanStack Query cache invalidation. WebSocket room joins are validated server-side — the client only sends `join-job-room` for jobs it can see.

## Subagents

`.claude/agents/` holds 12 frontend-scoped subagents (mirrors of the backend agents with FE-specific rule sets). See `.claude/agents/README.md` for the roster and how to invoke them.

## Roles

CLIENT, CS, TEAM_LEAD, DESIGNER (Junior/Senior via `sub_type`), DIGITATOR (Junior/Senior via `sub_type`), SEWOUT, QC, ADMIN.

`RoleGuard` renders different module surfaces per role; `useAuthStore.user.sub_type` switches between Junior and Senior workspaces inside the Designer / Digitator modules.

## License

Private.
