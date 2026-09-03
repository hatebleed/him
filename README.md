# Operations Platform (MDT)

A production-quality, **configuration-driven** operational records platform: people, vehicles, incidents, cases, reports, tasks, warrants, alerts, BOLOs, evidence, units, dispatch, communications, notifications and a full administration section — where modules, navigation, terminology, fields, forms, workflows, statuses, categories, permissions, dashboards, themes and branding are all changed **from the UI, without writing code**.

Everything in this repository is fictional demonstration data. No real personal data is used anywhere.

---

## 1. What was built

| Area | What it does |
|---|---|
| **Records** | People (identifiers, contacts, addresses), vehicles, incidents, cases, reports with immutable version history, tasks with comments, warrants, alerts, BOLOs, evidence with append-only chain of custody, units |
| **Operations** | Dispatch console (create calls, assign units, unit status, escalate call → incident), live operations board, unit roster with inline status changes |
| **Operations console** | **Ops wall** (schematic sector view with live units and open incidents, readiness gauges, event ticker, demand heatmap), **association graph** (multi-hop link analysis across people, vehicles, incidents, cases and evidence), **shift briefing** (generated roll-call handover for any 1–72 hour period) |
| **Communications** | Channels and direct messages with real persistence, read state and mentions |
| **Search** | Global, permission-filtered search across every record type, plus a command palette (<kbd>Cmd/Ctrl</kbd>+<kbd>K</kbd>) with page shortcuts |
| **Dashboards** | Per-user, database-stored widget layouts: metrics, lists, charts, quick actions; widgets are added/removed/reset from the UI |
| **Notifications** | Raised by records, workflows, approvals and messages; per-category preferences; unread badge; SSE-driven live updates |
| **Record infrastructure** | One reusable detail system: overview, **relationships** (generic record linker), **notes**, **attachments** (validated uploads), **timeline** and **audit** tabs on every record |
| **Administration** | Users, roles & permissions, departments, units, modules, navigation, custom fields, forms, workflows, statuses, categories, terminology, branding, appearance, notification settings, system settings, import/export, audit trail |
| **Automation** | Workflow engine (trigger → conditions → actions) executed server-side: change status, assign user/department, create task, notify, require approval, write timeline events; every run is logged |

---

## 1.1 Operations console

Three surfaces built on top of the same permission-gated services, rendered in a
distinct console design language (notched panels, HUD brackets, sector grid,
monospace figures and a signal palette for live / warn / hot / ok):

| Surface | Route | API | Permission |
|---|---|---|---|
| Ops wall | `/ops` | `GET /api/ops-wall` | `dispatch.view` |
| Associations | `/associations` | `GET /api/link-analysis?type=…&id=…&depth=1\|2` | `search.use` |
| Shift briefing | `/briefing` | `GET /api/briefing?hours=12` | `dispatch.view` |

- **Ops wall** — one payload for the live console: units with positions, open
  incidents, active calls with assigned callsigns, readiness and dispatch
  metrics, a day × hour demand heatmap, and the latest audit events. Polled
  every 15s and invalidated instantly by the SSE bridge.
- **Associations** — pick any record and the server walks its real links
  (participation, vehicle involvement, case membership, recorded
  relationships) up to two hops. Record types the operator cannot open are
  dropped server-side, so the graph can never be used to reach a record they
  could not open. Nodes open the record itself.
- **Shift briefing** — assembled from live records, never typed in: what
  happened in the period, what is still open (carry-over, not just period
  activity), active BOLOs, warrants, alerts, repeat involvement, the unit
  roster and reports submitted. Printable.

The design language lives in `src/components/ops/*` and the console layer of
`src/app/globals.css`, and is built entirely from the existing theme variables -
re-branding and light mode keep working. Two widgets (**Demand by day and hour**,
**Sector view**) are available in the dashboard catalogue and default layout.

---

## 2. Architecture

```
UI (React Server + Client Components)
   │  TanStack Query, TanStack Table, React Hook Form + Zod, Tailwind, Radix
   ▼
API routes  (/app/api/**/route.ts)
   │  route() / authRoute() wrappers: request id, validation, error envelope
   ▼
Application services  (/server/services/*)     ← business rules, orchestration, auditing
   │
   ├── Domain layer (/server/workflows, /server/configuration, /server/permissions)
   │
   └── Persistence (/server + Drizzle ORM → PostgreSQL)
```

- **Modular monolith** — one deployable, clear internal boundaries, no premature microservices.
- **Route factory** (`src/server/api/resource-routes.ts`): every resource exposes the same verbs with the same guarantees — authentication, validation, permission enforcement, standard envelope.
- **One data table** (`src/components/tables/data-table.tsx`) and **one record detail system** (`src/components/records/record-shell.tsx`) are reused by every module.
- **Pluggable providers**: dispatch (`MockDispatchProvider`), search (PostgreSQL provider), storage (local driver, S3-ready interface), notifications, email and realtime (in-process event bus consumed by `/api/events/stream` via SSE).
- **Configuration cache** with explicit invalidation, so an administrator's change is live immediately.

### Layer rules that are enforced in code

- UI never issues raw database queries — it calls API routes, which call services.
- Validation is defined once (Zod) and used by the form, the route and the service.
- Permissions are checked on the **server** for every request; `can()` in the UI only controls visibility.
- Errors carry `{ code, message, requestId }`; stack traces never leave the server.

---

## 3. Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router, React 19, TypeScript strict) |
| ORM | **Drizzle ORM** with versioned SQL migrations in `drizzle/` |
| Database | PostgreSQL 17 (indexes, foreign keys, soft delete, JSON metadata) |
| Data fetching | TanStack Query v5, TanStack Table v8 |
| Forms | React Hook Form + Zod |
| UI | Tailwind CSS, Radix primitives, Lucide icons, Sonner toasts, cmdk |
| Auth | Session cookie (httpOnly, hashed token, server-side revocation), scrypt password hashing |
| Tests | Vitest (unit, integration, security, end-to-end) |

> **Note on the ORM choice.** The brief asked for Prisma. Prisma downloads its query/schema engine binaries at install and generate time from `binaries.prisma.sh` / `download.prisma.io`; neither is reachable from this environment, so `prisma generate` and `prisma migrate` cannot run at all. **Drizzle ORM** was used instead: it is pure TypeScript, ships no binaries, and still produces real versioned SQL migrations with indexes, foreign keys, constraints and soft-delete columns. Every schema guarantee from the brief is preserved. Switching back to Prisma later means replacing the persistence layer only (`src/lib/db`, `drizzle/`) — services and UI are unaffected.

---

## 4. Database

- **45 tables** across auth, organisation, operations, records, communications, configuration and system concerns.
- Versioned migrations: `drizzle/0000_init.sql` (generated by `npm run db:generate`).
- Design points: UUID primary keys, `created_at/updated_at/created_by_id/updated_by_id` on mutable records, `deleted_at` soft delete on business records, indexes on status/priority/foreign keys/`created_at`, unique constraints on references, append-only `audit_logs` and `timeline_entries`.
- Configurable concepts are **rows, not columns**: statuses, categories, custom fields, forms, workflows, navigation, terminology, modules, roles/permissions. Adding a custom field never requires a migration.

---

## 5. Security

- Session cookies: `httpOnly`, token stored **hashed** in the database, revocable per user. `SameSite`/`Secure` are resolved per request so the same build works first-party, behind a TLS-terminating proxy and inside an embedded frame (see [§5.1](#51-session-cookies-in-embedded-deployments)).
- **Two authentication modes.** `AUTH_MODE=none` (the default in this workspace) has no sign-in at all: every request runs as `OPERATOR_USER`, a real account with real roles and permissions, and every credential route returns 404 so there is nothing to attack. `AUTH_MODE=password` restores the full sign-in flow below. Authorisation is never optional in either mode.
- **CSRF**: state-changing requests are rejected when the browser reports them as cross-site (`Sec-Fetch-Site`), or when `Origin` names another host; non-browser clients that send no origin metadata still work. This is what makes `SameSite=None` safe.
- Passwords: scrypt with a per-user salt, timing-safe comparison, policy (≥12 chars, mixed case, digit), lockout after repeated failures, forced change on reset.
- **Authorisation**: `resource.action` permissions resolved server-side from the session; guards in services *and* routes; role-permission writes are protected so the platform can never be left without a role able to manage roles.
- **IDOR**: every query is scoped by permission, and notification/attachment/relationship endpoints scope by the signed-in user (or by record access), not by client-supplied identity.
- **Uploads**: extension allow-list **plus** magic-byte sniffing; the client-declared MIME type alone is never trusted; files are streamed only to users who may read the parent record, with `nosniff` and `Content-Disposition: attachment`.
- **Validation**: Zod on every input; conditional field rules are enforced server-side even though the UI also hides them.
- **Audit**: create/update/delete/status changes/approvals/reviews/configuration changes and failed sign-ins are recorded; searching the audit trail is itself audited.
- **Headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; error responses never expose internals.

---

## 5.1 Session cookies in embedded deployments

A sign-in can succeed on the server and still leave the user on the login page:
if the application is rendered inside a frame belonging to another site (a
hosted preview, an intranet portal, a partner dashboard), the browser treats the
session cookie as third-party and **silently discards** anything that is not
`SameSite=None; Secure`. Nothing errors — the next request is simply anonymous.

The platform resolves the attributes per request rather than trusting one global
flag (`src/lib/auth/cookie.ts`, `src/lib/auth/session.ts`):

| Context | Cookie issued |
| --- | --- |
| Embedded in a frame, browser on HTTPS | `Secure; HttpOnly; SameSite=None; Partitioned` |
| Top-level or same-site, browser on HTTPS | `Secure; HttpOnly; SameSite=None` |
| Browser on plain HTTP (local development) | `HttpOnly; SameSite=Lax` |
| Non-browser client (no `Origin`/`Referer`) | `HttpOnly; SameSite=Lax` |

A partitioned cookie ([CHIPS](https://developer.chrome.com/docs/privacy-sandbox/chips)) is used when the page reports
it is inside a frame (the client sets `x-embedded`), because a browser that
blocks third-party cookies still accepts a partitioned one. The server cannot
detect this on its own: a fetch issued from inside the frame is same-origin, so
the client - which can compare `window.self` with `window.top` - supplies the
signal.

Detection order is `Origin` → `Referer` → `x-forwarded-proto`/`Forwarded`. The
browser's own headers come first because they describe the scheme the browser
used, which is the only thing that matters for `Secure`; a proxy-to-application
hop is plain HTTP in every TLS-terminating deployment. `SameSite=None` is never
emitted without `Secure`, because browsers reject that combination outright.

The sign-in page verifies the session actually persisted before navigating. If a
browser still refuses the cookie (for example a policy that blocks all
third-party cookies), the user is told what happened and offered a button to
open the application top-level, where the cookie is first-party.

Related environment variables (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `COOKIE_SECURE` | `auto` | Force `Secure` on (`true`) or off (`false`) instead of detecting it. |
| `COOKIE_SAMESITE` | `auto` | Force `lax`, `strict` or `none`. |
| `TRUSTED_ORIGINS` | *empty* | Extra origins allowed to call the API (comma separated). |
| `CSRF_PROTECTION` | `true` | Reject state-changing requests browsers report as cross-site. |

---

## 6. Configuration capabilities (no code changes)

- **Modules** — enable/disable (core modules protected); navigation and data follow.
- **Navigation** — rename, re-group, re-order, hide or add items (icons, permission gating).
- **Terminology** — rename any concept (e.g. *Incident* → *Occurrence*) across navigation, headings and empty states.
- **Statuses & categories** — labels, colours, defaults and which statuses close a record.
- **Custom fields** — per record type: type, section, help text, required, options, validation, conditional visibility, show-in-list.
- **Forms** — field builder with types and conditions; publish; submit against records (validated, stored, workflow-triggering).
- **Workflows** — trigger (created/updated/status changed/form submitted/report submitted/assigned) + conditions + actions.
- **Roles & permissions** — grouped by category, per-role toggles, multi-role users.
- **Branding & appearance** — organisation identity, colour tokens, mode, density, radius, fonts, motion.
- **Dashboards** — per-user widget layout and catalogue.
- **Import/export** — CSV import with column mapping, server-side validation and a dry-run error report; CSV export for every list the user can see.

---

## 7. Running it

### Option A — two commands with the bundled PostgreSQL

```bash
npm install
npm run setup     # starts the local PostgreSQL, applies migrations, seeds demo data
npm run dev       # http://localhost:3000
```

The bundled PostgreSQL (npm `embedded-postgres`) listens on **127.0.0.1:5433**; `npm run db:local:stop` stops it.

### Option B — your own PostgreSQL

```bash
cp .env.example .env     # set DATABASE_URL and AUTH_SECRET (>= 32 chars)
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### Option C — Docker

```bash
docker compose up --build
docker compose exec app npx tsx scripts/seed.ts
```

### Running without sign-in

`AUTH_MODE=none` removes the sign-in feature entirely. Open `/` (or any page)
and the MDT loads, with no prompt, no cookie and no session:

```bash
AUTH_MODE="none"       # "password" enables the sign-in flow instead
OPERATOR_USER="admin"  # the account every request runs as
```

This is not anonymous access and not a bypass. Each request is attributed to a
real account and carries that account's roles and permissions, resolved from the
database exactly as they are after a password sign-in, so authorisation, audit
entries, workflows and notifications are unchanged. Every `/api/auth/*` route
returns 404, the sign-in page redirects to the dashboard, and the UI drops the
sign-out and change-password controls. If `OPERATOR_USER` does not name an
active account the application fails loudly instead of granting nothing.

Switch to `AUTH_MODE="password"` for anything holding real data; that restores
the sign-in page, sessions, lockout and password reset described above.

### Scripts
### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Development, production build, production server |
| `npm run setup` | One-shot bootstrap (local DB + migrate + seed) |
| `npm run db:local` / `db:local:stop` | Start/stop the bundled PostgreSQL |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` / `db:reset` | Seed demo data / drop + migrate + seed |
| `npm run typecheck` / `lint` / `format` | Quality gates |
| `npm test` | All Vitest suites (unit, integration, security) |
| `npm run test:e2e` | End-to-end acceptance journey (needs a running server) |

---

## 8. Demo credentials

Password for every seeded account: **`DemoPass123!`**

| Username | Role | What it demonstrates |
|---|---|---|
| `admin` | Administrator | Full configuration access: modules, fields, workflows, roles, branding |
| `supervisor1` | Supervisor (+ Operations) | Approvals, oversight, review |
| `supervisor2` | Supervisor (Investigations) | Case review |
| `operator1` | Operator **and** Supervisor | Multi-role permissions, dispatch, record creation |
| `operator2` | Operator | Control-room work |
| `analyst1` | Standard user | Day-to-day reporting and tasks |
| `officer1` / `officer2` | Standard users | Assigned tasks and unit work |
| `readonly` | Read only | View-only access — API writes return **403** |

---

## 9. Testing

```bash
npm test                                   # unit + integration + security (72 tests)
npm run dev &                              # or npm start
RUN_E2E=1 npm run test:e2e                 # acceptance journey + operations console + cookie/CSRF over HTTP
RUN_E2E=1 E2E_BASE_URL=http://host:3000 npm run test:e2e
```

| Suite | Covers |
|---|---|
| `tests/unit` | Conditional-rule engine, validation schemas, shared utilities, error envelope, password policy, **session cookie policy** (HTTPS, proxies, embedded frames, overrides), **cross-site request forgery guard**, **console geometry** (sector projection, declutter, temporal binning, deterministic graph layout) |
| `tests/integration` | Real services against the real database: permissions, person creation with timeline/audit, incident linking, report lifecycle and versioning, custom-field validation, configuration reads |
| `tests/security` | Password hashing/salting/verification, token hashing, upload magic-byte and size validation, server-side authorisation, role-permission guarantees |
| `tests/e2e` | The full journey: sign in → shell → search → create/link person + vehicle + incident → write/submit/approve report → workflow notification → timeline → audit → admin (custom field, terminology, module toggle, role permissions) → 403 for a read-only user; plus the operations console (ops wall payload, briefing, association graph, temporal analytics, page rendering) |

The end-to-end suite also covers the cookie matrix (`SameSite=None; Secure; Partitioned` when embedded, `Lax` on plain HTTP), cross-site write rejection, and - under `AUTH_MODE=none` - loading the application with no credentials while every credential route 404s. Mode-specific cases skip themselves, so the suite is correct against either configuration. It is skipped unless `RUN_E2E=1` because it needs a live server and a seeded database.

---

## 10. Limitations

- **Docker was not available in the build environment**, so `Dockerfile` / `docker-compose.yml` are provided but were not executed here. Everything else was run and verified locally.
- **Email delivery** is abstracted (`EMAIL_PROVIDER`); the console adapter logs reset links instead of sending them. Password reset works end-to-end, but no SMTP/SendGrid transport is wired up.
- **S3 storage** is stubbed: the local disk driver is fully implemented; the S3 driver raises a clear "not configured" error rather than silently failing.
- **MFA**: the schema and account states exist (`mfa_enabled`), and the session model supports it, but no TOTP enrolment flow is implemented.
- **Analytics/BI**: dashboards are built from live aggregates and small inline charts; there is no separate warehouse or reporting engine.
- **Full-text search** uses PostgreSQL `ILIKE` with relevance ranking. A trigram/OpenSearch provider can be dropped in behind the `SearchProvider` interface for larger datasets.
- **Realtime** uses an in-process event bus with SSE, which is correct for a single instance; a Redis/WebSocket provider is needed for horizontal scaling.
- **Rate limiting** is not implemented (lockout covers credential attacks; a shared limiter belongs at the edge/WAF).
- **Cookies in embedded contexts** depend on browser policy. The platform issues `SameSite=None; Secure` when the browser is on HTTPS and tells the user when a cookie was refused, but a browser configured to block all third-party cookies will still refuse it inside a frame on another site; opening the application top-level always works.

## 11. Natural next steps

1. Redis-backed rate limiting and a Redis/WebSocket realtime provider for multi-instance deployments.
2. TOTP enrolment and recovery codes (schema is ready).
3. S3 storage driver and antivirus scanning hooks on upload.
4. Saved views and column preferences per user (the `saved_views` table exists; the UI surface is next).
5. Scheduled jobs for retention (`notifications.retentionDays`) and SLA reminders.
6. OpenTelemetry tracing and metrics export.
7. Documented REST/OpenAPI specification generated from the route schemas.
