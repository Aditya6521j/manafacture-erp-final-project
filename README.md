# Manufacture ERP — Production Planning & Quality Control System

A complete, working full-stack manufacturing ERP: **Angular 22 (standalone components + signals) → Express REST API → MongoDB/Mongoose**, with JWT auth, role-based access control, Chart.js dashboards, real CRUD everywhere, live inventory deduction, automatic quality calculations and downloadable PDF/Excel reports.

Everything below has been executed and verified in this workspace — this is a running application, not a prototype.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 22 (standalone, signals, new `@if`/`@for` control flow), TypeScript 5.9, plain CSS3 design system (dark navy / steel blue / white) |
| Charts | Chart.js 4 (via `chart.js` + a reusable `<app-chart>` wrapper, no decorative placeholders) |
| Routing | Angular Router with lazy `loadComponent` routes + auth/role guards |
| Backend | Node.js 22 + Express 4, modular `routes → controllers → services → models` |
| Database | MongoDB 7 + Mongoose 8 |
| Auth | JWT (`jsonwebtoken`) + bcrypt password hashing + `protect` / `authorize(...roles)` middleware |
| Files | `multer` uploads (defect images) served from `/uploads` |
| Reports | `exceljs` (XLSX) and `pdfkit` (PDF) generated server-side |
| Hardening | `helmet`, `cors`, `express-rate-limit`, `morgan`, central `errorHandler` |

---

## 2. Quick start

Prerequisites: **Node ≥ 22.22.3**, **npm ≥ 10**, **MongoDB 7** running locally on `27017`.

```bash
# --- 1. Backend -------------------------------------------------------------
cd backend
npm install
cp .env.example .env          # then edit values (see §3)
npm run seed                  # loads all demo data (see §5)
npm run dev                   # http://localhost:5000  (node --watch)
# or: npm start

# --- 2. Frontend (dev mode, hot reload) -------------------------------------
cd frontend
npm install
npm start                     # http://localhost:4200  (ng serve, proxies /api → :5000)
```

### Production-style single server (what is running here)

```bash
cd frontend && npm run build            # outputs to ../backend/public/browser
cd ../backend && npm start              # Express serves the API *and* the built SPA on :5000
```

Open **http://localhost:5000** → you land on `/login`.

> The Express server auto-detects the Angular build: it serves `public/browser` when `public/browser/index.html` exists (Angular 22's application builder writes there), otherwise `public`. Any non-API route falls back to `index.html` for client-side routing.

---

## 3. Environment configuration — `backend/.env`

```ini
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/manufacturing_erp
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=1d
CLIENT_ORIGIN=*            # restrict to https://your-frontend in production
```

`frontend/proxy.conf.json` forwards `/api` and `/uploads` to `http://127.0.0.1:5000` during `ng serve`. The Angular app always calls the **relative** `/api` base URL, so no CORS or hard-coded host is needed in either mode.

---

## 4. Database setup

```bash
# any standard MongoDB 7 install
mongod --dbpath /path/to/data --port 27017

# in this workspace the bundled binary is used:
/home/user/start-db.sh        # mongod --dbpath backend/.mongodata --port 27017
```

The database `manufacturing_erp` and all collections/indexes are created automatically on first write / seed. There is no migration step.

---

## 5. Demo data & credentials

```bash
cd backend
npm run seed:destroy   # drops all collections
npm run seed           # rebuilds the full realistic dataset
```

| Role | Email | Password |
|---|---|---|
| Admin | admin@manufacture.com | Admin@123 |
| Production Manager | manager@manufacture.com | Manager@123 |
| QC Inspector | qc@manufacture.com | Qc@123 |
| QC Inspector (2nd) | inspector2@manufacture.com | Inspector@123 |
| Inventory Manager | inventory@manufacture.com | Inventory@123 |
| Machine Operator | operator@manufacture.com | Operator@123 |

Seeded volume (current run): 6 products · 13 production orders · 10 schedules · 12 raw materials · 5 suppliers · 12 quality inspections · 6 defect records · 6 machines · 6 maintenance records · 12 employees · 5 departments · 6 users · 13 notifications.

---

## 6. Project structure

```
backend/
├── config/         db.js, env.js
├── controllers/    auth, user, department, product, productionOrder, schedule, material,
│                   supplier, inspection, defect, machine, maintenance, employee,
│                   notification, dashboard, report
├── middleware/     auth (protect/authorize), upload (multer), errorHandler, validate
├── models/         User, Department, Product, ProductionOrder, ProductionSchedule,
│                   RawMaterial, Supplier, QualityInspection, DefectRecord, Machine,
│                   MaintenanceRecord, Employee, Notification
├── routes/         16 routers mounted under /api
├── services/       business logic (quality math, stock movement, reportService, alerts)
├── utils/          asyncHandler, ApiError, seed.js
├── uploads/        defect images
├── public/browser/ built Angular app served in production mode
└── server.js       Express app, security, static SPA fallback

frontend/src/app/
├── core/           services (api, auth, production, inventory, quality, machine,
│                   employee, notification, dashboard, report, lookup, toast), guards,
│                   interceptors, models
├── shared/         reusable UI: modal, data-table, stat-card, chart, badge, toast
│                   container, empty-state, pagination, confirm-dialog, page-header
├── auth/           login.component.ts, register.component.ts
├── layout/         app-shell.component.ts, sidebar.component.ts, topbar.component.ts
├── dashboard/      dashboard.component.ts (8 KPI cards + 6 charts + activity feed)
├── production/     production-list, production-form, production-detail
├── scheduling/     scheduling.component.ts (daily/weekly/monthly + calendar/timeline)
├── inventory/      inventory.component.ts, material-form, supplier-form
├── quality-control/quality-control.component.ts, inspection-form
├── defects/        defects.component.ts, defect-form
├── machines/       machines.component.ts, machine-form
├── employees/      employees.component.ts, employee-form
├── reports/        reports.component.ts (9 report types, preview + download)
├── notifications/  notifications.component.ts
└── settings/       settings.component.ts, user-form, department-form
```

Routes: `/login`, `/register`, `/dashboard`, `/production`, `/production/:id`, `/scheduling`, `/inventory`, `/quality-control`, `/defects`, `/machines`, `/employees`, `/reports`, `/notifications`, `/settings`.

---

## 7. Modules & what each one actually does

1. **Dashboard** — 8 live KPIs (total/completed/pending orders, products manufactured, defective products, quality pass %, available raw materials, active machines), 6 Chart.js charts (monthly production overview, target vs actual, product quality analysis, defect rate, machine utilization, raw material consumption), recent activity, pending tasks, alert strip and notifications — all from MongoDB aggregations.
2. **Production planning** — create/edit/delete orders (product, quantity, dates, manager, department, machine allocation, material allocation, priority, notes), status workflow (Planned → Approved → In Progress → On Hold → Completed / Cancelled), search, status/priority filters, sortable columns, pagination, detail page with progress updates and material consumption. Machines in *Breakdown* / *Under Maintenance* are visibly disabled and rejected server-side.
3. **Scheduling** — daily/weekly/monthly views, machine + employee allocation, deadline tracking, workload per machine, timeline/calendar grid, delayed-order and conflict highlighting.
4. **Inventory** — materials CRUD (Material ID, name, category, available/required qty, unit, supplier, stock status), purchase (stock in), consumption (stock out, with automatic `production-orders/:id/consume-materials`), suppliers CRUD, low-stock alerts, stock movement history.
5. **Quality control** — inspections per order/batch with inspector, standard, measured vs acceptable limits (dimensions, weight, surface finish, temperature, hardness, visual defects, functional performance), automatic verdict + pass % / defect %, approve/reject a batch, statuses Passed / Failed / Pending Inspection / Rework Required.
6. **Defects** — record defects in 6 categories (Dimensional, Surface, Material, Assembly, Functional, Packaging) with description, image upload, responsible department, corrective action, rework status and history; category/severity analysis.
7. **Machines** — register, assign to orders, availability, operating hours, preventive maintenance scheduling, breakdown reporting (status → Breakdown + notification), utilization and maintenance history.
8. **Employees** — CRUD with department, job role, availability, task allocation, completion tracking.
9. **Reports** — 9 report types (daily/weekly/monthly production, production efficiency, quality inspection, defect analysis, material consumption, machine utilization, employee performance) with date filters, on-screen preview and **real XLSX/PDF downloads**.
10. **Notifications** — generated server-side for low stock, deadlines, delayed orders, breakdowns, failed inspections, pending approvals and maintenance due; unread badge in the topbar + full history page with mark-as-read.

### Role-based access control

| Capability | Admin | Prod. Manager | QC Inspector | Inventory Mgr | Machine Operator |
|---|---|---|---|---|---|
| Users & departments, system settings | ✅ | — | — | — | — |
| Production orders create/edit/delete | ✅ | ✅ | — | — | — |
| Inspections create / approve / reject | ✅ | — | ✅ | — | — |
| Materials, purchases, suppliers | ✅ | — | — | ✅ | — |
| Machines & maintenance | ✅ | ✅ | — | — | status/progress only |
| Reports & downloads | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update own task progress / report breakdown | — | — | — | — | ✅ |

Enforced twice: Angular route/`*appHasRole` guards hide or disable nav items and action buttons, and every Express route is wrapped in `protect` + `authorize(...roles)`, so direct API calls are rejected with 403 as well.

---

## 8. API reference (all under `/api`)

```
POST   /auth/login                        { email, password } → { token, user }
POST   /auth/register                     GET /auth/me  GET /auth/roles
PUT    /auth/profile                      PUT /auth/password

GET/POST/PUT/DELETE  /users, /departments, /products, /suppliers, /employees, /schedules
GET/POST/PUT/DELETE  /production-orders   + GET /stats/summary
                                          + PATCH /:id/status, /:id/progress,
                                                  /:id/consume-materials
GET/POST/PUT/DELETE  /materials           + GET /all, /low-stock, /stats
                                          + POST /:id/purchase, /:id/consume,
                                                 /sync-requirements
GET/POST/PUT/DELETE  /inspections         + GET /stats, PATCH /:id/approve
GET/POST/PUT/DELETE  /defects             + GET /stats/analysis
GET/POST/PUT/DELETE  /machines            + GET /all, /utilization/summary
                                          + PATCH /:id/status, POST /:id/maintenance
GET/POST/PUT/DELETE  /maintenance
GET    /notifications, /unread-count      + PATCH /:id/read, /read-all  POST /refresh
GET    /dashboard/overview, /dashboard/stats, /dashboard/charts
GET    /reports/types
GET    /reports/:type?from=&to=                 → JSON preview
GET    /reports/:type/download?format=xlsx|pdf  → binary file
```

Response envelope: `{ success, message, data }`; lists add `meta: { total, page, limit, pages }`.

---

## 9. Verification performed

* **Route smoke test** (`/home/user/.tools/verify.mjs`, headless Chromium): login → dashboard KPIs render, 6 charts draw, and all 10 sidebar modules display live rows; **0 console errors**.
* **Interaction suite** (`/home/user/.tools/flows.mjs`): create production order (201 + success toast + modal closes), empty-form validation (5 inline messages), create inspection → live pass-% chip, approve pending batch, record stock purchase, run a report preview (14 rows), report a machine breakdown (red toast), and RBAC checks — operator sees 0 create/edit buttons, inventory manager sees 0 "New Inspection". **0 console errors.**
* **Visual review**: desktop screenshots in `/home/user/screenshots/` (`00-login` … `17-mobile-dashboard`) plus a 3× retina crop of the alert strip; mobile 420 px view verified (collapsible sidebar, stacked cards).

Two real bugs were found and fixed during this testing:
1. Re-opening a create modal kept the previous entry (fixed with an `initForm()` reset driven by an `open()` effect in all 9 form components).
2. `@for` tracking FormArray controls by `$index` bound inputs to stale control instances after that reset, so submits wrote into a detached group and silently failed — now tracked by control identity, and half-filled material/parameter rows are pruned with inline validation instead of blocking submit invisibly.

---

## 10. Scripts

| Location | Command | Purpose |
|---|---|---|
| backend | `npm start` | run the API + built SPA on :5000 |
| backend | `npm run dev` | same, with `node --watch` |
| backend | `npm run seed` / `npm run seed:destroy` | load / wipe demo data |
| frontend | `npm start` | `ng serve` on :4200 with API proxy |
| frontend | `npm run build` | production build into `../backend/public` |
| frontend | `npm run watch` | dev-config rebuild on change |

---

## 11. Restoring the environment in a fresh sandbox

Only files under `/home/user` are snapshotted, and `node_modules`, `.cache` and other
dependency folders are deliberately excluded — so after a sandbox restart the binaries and
dependencies must be reinstalled, while **the source, the built SPA and the database
(`backend/.mongodata`) are preserved**.

```bash
# 1. runtime binaries (not snapshotted)
curl -sSL -o /tmp/mongo.tgz https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian12-7.0.14.tgz
mkdir -p /home/user/.cache/mongodb && tar -xzf /tmp/mongo.tgz -C /tmp \
  && mv /tmp/mongodb-linux-x86_64-debian12-7.0.14/* /home/user/.cache/mongodb/

# 2. backend dependencies
cd /home/user/backend && npm install

# 3. database (data persists; run the seed only if .mongodata was lost/empty)
/home/user/start-db.sh &          # or: use start_process for a managed background job
node utils/seed.js                # only when the database is empty

# 4. app + API on :5000
node server.js
```

There is no need to rebuild the frontend: `backend/public/browser` holds the compiled app and
Express serves it directly (rebuild with `cd frontend && npm install && npm run build` only if
you change Angular source, which needs Node ≥ 22.22.3).

## 12. Troubleshooting

* **Blank page from Express after a rebuild** — confirm `backend/public/browser/index.html` exists; the server prefers that folder, otherwise it serves `public/`.
* **401/403 in the UI** — the JWT expired; log in again (token is stored in `localStorage` and injected by an HTTP interceptor, which redirects to `/login` on 401).
* **`ng serve` can't reach the API** — make sure the backend is on `127.0.0.1:5000` (`frontend/proxy.conf.json`).
* **Reports download as 0 bytes** — the report window returned no rows; widen the date range.
* **Node version** — Angular 22 requires Node ≥ 22.22.3; `node -v` first.
</content>
