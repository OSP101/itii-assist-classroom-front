# Performance & Data Flow Audit — ITII Assist Classroom Frontend

Generated: 2026-05-08

## Summary

| Metric | Before Refactor | Target After |
|--------|----------------|-------------|
| Total Routes | 43 | 43 (no removal) |
| Server Components | 0 | Progressive (critical data paths) |
| Routes with loading.tsx | 7 (admin only) | 30+ |
| Routes with error.tsx | 1 (global only) | 20+ scoped |
| API calls deduplicated | ❌ multiple duplicates | ✅ page-owned orchestration |
| Cache policy | ❌ none (localStorage only) | ✅ domain-tagged cache |
| Skeleton system | ⚠️ mixed ad-hoc styles | ✅ unified ProSkeleton |
| Realtime | Custom WebSocket (good) | ✅ abstracted hook |

---

## Route-by-Route Audit

| Route/Page | Current API Calls | Duplicate Calls | Critical Data | Secondary Data | Realtime Data | Cache Strategy | Skeleton Strategy | Refactor Priority |
|---|---|---|---|---|---|---|---|---|
| `/` (root redirect) | authService.me | none | auth session | — | — | none | none | Low |
| `/login` | none (form submit) | none | — | — | — | no-cache | none | Low |
| `/profile` | getCurrentUser | none | user profile | sessions list, 2FA status | — | `global:me` minutes | profile skeleton | Medium |
| `/permissions` | courseService.getAll | none | permissions list | — | — | `global:my-courses` minutes | list skeleton | Low |
| `/(instructor)/home` | 5x (user, instructors, courses, stats, socket) | courses fetched 2x | my-courses, user | recent activity, stats | course updates (socket) | `global:my-courses` minutes | CourseGridSkeleton | **High** |
| `/(instructor)/home/closed` | archived courses | none | closed courses | — | — | `global:my-courses` minutes | CourseGridSkeleton | Low |
| `/(instructor)/classroom/[id]` | 10+ (classroom, overview, assignments, attendance, teams, people, sections, scores, permissions, socket) | overview fetched 3x, classroom fetched 2x | course detail, permissions | charts, analytics, secondary widgets | live updates (socket) | `course:{id}:*` tags | DashboardSkeleton | **Critical** |
| `/(instructor)/classroom/[id]/overview` | Delegates to `[id]/page` | Same as parent | — | — | — | — | — | **Critical** (fix parent) |
| `/(instructor)/classroom/[id]/assignments` | Delegates to `[id]/page` | — | assignment list | stats | — | `course:{id}:assignments` | TableSkeleton | **High** |
| `/(instructor)/classroom/[id]/attendance` | Delegates to `[id]/page` | — | session list | session stats | — | `course:{id}:attendance` | TableSkeleton | **High** |
| `/(instructor)/classroom/[id]/attendance/.../live` | attendance records, socket | records polled + socket duplicate | session info, records | — | real-time records | no-cache (live) | LiveMonitorSkeleton | **High** |
| `/(instructor)/classroom/[id]/queue` | Delegates to `[id]/page` | — | session list | queue stats | — | `course:{id}:queue` | CardListSkeleton | High |
| `/(instructor)/classroom/[id]/scores` | Delegates to `[id]/page` | — | score matrix, assignments | ungraded summary, analytics | — | `course:{id}:scores` | MatrixTableSkeleton | **High** |
| `/(instructor)/classroom/[id]/approval` | Delegates to `[id]/page` | — | pending requests | stats | — | `course:{id}:score-approvals` | RequestListSkeleton | High |
| `/(instructor)/classroom/[id]/exam-scores` | Delegates to `[id]/page` | — | exam settings, scores | stats | — | `course:{id}:exams` | TableSkeleton | Medium |
| `/(instructor)/classroom/[id]/people` | Delegates to `[id]/page` | — | instructors, TAs, students | removed students | — | `course:{id}:people` | TabbedListSkeleton | Medium |
| `/(instructor)/classroom/[id]/sections` | Delegates to `[id]/page` | — | sections list | section students | — | `course:{id}:sections` | ListSkeleton | Medium |
| `/(instructor)/classroom/[id]/ta-stats` | Delegates to `[id]/page` | — | TA workload | charts | — | `course:{id}:ta` | DashboardSkeleton | Low |
| `/(instructor)/classroom/[id]/activity-log` | Delegates to `[id]/page` | — | first page logs | timeline | — | `course:{id}:activity` short | TableSkeleton | Medium |
| `/(instructor)/classroom/[id]/settings` | Delegates to `[id]/page` | — | course settings | — | — | `course:{id}:settings` hours | FormSkeleton | Low |
| `/admin/dashboard` | 6+ (users, students, courses, classrooms, logs, metrics) | stats fetched independently per card | counts, server status | charts, recent logs | — | `admin:*` minutes | DashboardSkeleton | High |
| `/admin/users` | user list + stats | none | first page list, stats | — | — | `admin:users` minutes | TableSkeleton | Medium |
| `/admin/students` | student list + stats | none | first page list, stats | — | — | `admin:students` minutes | TableSkeleton | Medium |
| `/admin/courses` | course list + stats | none | first page list, stats | — | — | `admin:courses` minutes | TableSkeleton | Medium |
| `/admin/classrooms` | classroom list + stats | none | first page list, stats | — | — | `admin:classrooms` minutes | TableSkeleton | Medium |
| `/admin/feedback` | feedback list | none | first page list | — | — | `admin:feedback` minutes | TableSkeleton | Low |
| `/admin/logs` | system logs | none | first page logs | stats | — | `admin:logs` short | TableSkeleton | Low |
| `/admin/monitoring` | none (shell) | — | — | — | — | no-cache | tabs container | Low |
| `/admin/monitoring/system` | `/monitoring/system` **(MISMATCH)** | — | system metrics | — | polling | no-cache | MetricCardSkeleton | **High (endpoint fix)** |
| `/admin/monitoring/containers` | `/monitoring/containers` **(MISMATCH)** | — | container list | — | polling | no-cache | MetricCardSkeleton | **High (endpoint fix)** |
| `/admin/monitoring/website` | `/monitoring/website` **(MISMATCH)** | — | website metrics | — | polling | no-cache | MetricCardSkeleton | **High (endpoint fix)** |
| `/admin/profile` | getCurrentUser | none | user profile | — | — | `global:me` | ProfileSkeleton | Low |
| `/auth/callback` | oauth exchange | none | — | — | — | no-cache | none | Low |
| `/auth/link-callback` | oauth link | none | — | — | — | no-cache | none | Low |
| `/auth/verify-2fa` | 2FA verify | none | — | — | — | no-cache | none | Low |
| `/auth/reset-password` | reset | none | — | — | — | no-cache | none | Low |
| `/attendance/[id]/session/[sessionId]/live` | session, records, socket | records via socket + polling | session info, initial records | — | WebSocket records | no-cache | LiveMonitorSkeleton | **High** |
| `/check-in/[sessionId]` | session info, google auth | none | session info | — | socket for status | short cache for session info | StepFormSkeleton | High |
| `/queue/book` | PIN verify, student info, booking | none | session info | — | socket | no-cache (live) | StepFormSkeleton | Medium |
| `/queue/projector/[sessionId]` | desk statuses, socket | desks polled + socket duplicate | session, desk layout | — | WebSocket desk updates | no-cache (live) | ProjectorSkeleton | High |

---

## Issues Found

### 🔴 Critical: All Pages Are Client Components

- **All 43 pages have `"use client"`** — zero Server Components
- Initial data fetching happens in `useEffect` on mount
- This causes visible loading flicker on every page navigation
- **Fix**: Progressively migrate critical-data fetches to Server Components or server actions

### 🔴 Critical: Classroom [id]/page.tsx Fetches Too Much

- The `[id]/page.tsx` acts as a "god component" tab router
- It fetches 10+ API endpoints on mount regardless of which tab is active
- Data for "scores", "attendance", "queue" etc. is fetched even when viewing "overview"
- **Fix**: Each tab should own its critical data; parent only fetches shell data (course detail + permissions)

### 🔴 Critical: Monitoring Endpoint Mismatch

The frontend `monitoring.service.ts` calls endpoints that **do not exist** in the backend:

| Frontend calls | Backend reality | Status |
|---|---|---|
| `/monitoring/system` | `/system/metrics` (partial overlap) | **MISMATCH** |
| `/monitoring/containers` | **No endpoint found** | **TODO: verify with backend** |
| `/monitoring/website` | **No endpoint found** | **TODO: verify with backend** |

Backend routes confirmed at `/api/system/*`:
- `GET /system/metrics` → `GetSystemMetricsHandler`

(`/system/cpu`, `/system/memory`, `/system/info` were removed — nothing called them, `/system/metrics` already covers this data.)

**Action**: Update `config/api.ts` MONITORING endpoints to use `/system/*` where possible. Mark container and website endpoints as TODO until backend confirms or adds endpoints.

### 🟠 High: Duplicate API Calls

| Page | Duplicated Endpoint | Cause |
|---|---|---|
| `/(instructor)/home` | courses list | fetched for stats AND for display separately |
| `/(instructor)/classroom/[id]` | course overview | fetched by parent AND by header/breadcrumb components |
| `/(instructor)/classroom/[id]` | classroom detail | fetched by multiple child components independently |
| `/admin/dashboard` | each stat card triggers its own fetch | no request batching |

### 🟠 High: Missing loading.tsx for All Instructor Routes

No `loading.tsx` exists for:
- `/(instructor)/home`
- `/(instructor)/classroom/[id]` and all sub-routes
- `/profile`
- `/check-in/[sessionId]`
- `/queue/book`
- `/queue/projector/[sessionId]`
- `/attendance/[id]/session/[sessionId]/live`

### 🟡 Medium: Realtime Has Potential Double Fetch

- `/queue/projector/[sessionId]`: fetches desk statuses via REST, then opens WebSocket for same data → potential double state update
- `/attendance/.../live`: same pattern — initial HTTP + socket update can cause flicker
- **Fix**: Use `useRealtimeResource` pattern — server fetches initial snapshot, client subscribes

### 🟡 Medium: No Scoped Error Boundaries

Only one global `app/error.tsx`. A chart error or secondary section error will bubble up to crash the whole page.

### 🟢 OK: Custom WebSocket (Not Socket.IO)

`services/realtime-socket.ts` is a custom WebSocket implementation — compatible with Go backend's `/ws` endpoint. No Socket.IO dependency.

### 🟢 OK: Admin Loading Skeletons

Admin section already has `loading.tsx` for 7 routes. These serve as a template for the instructor section.

### 🟢 OK: Dynamic Imports on Classroom Page

`[id]/page.tsx` already uses `next/dynamic` with custom loading skeletons for tab components — good pattern to extend.

---

## Component-level Fetch Scattering

These components are **suspected** to fetch data independently (verified via service imports in `[id]/page.tsx`):

| Component | Suspected Independent Fetch | Should Be |
|---|---|---|
| CourseHeader | classroom detail | Receive as prop from parent |
| Breadcrumb | course name | Receive as prop |
| HealthCard | overview stats | Receive as prop |
| ActionCenter | pending counts | Receive as prop |
| Sidebar nav badges | course counts | Receive as prop |

---

## Recommended loading.tsx Routes to Add

```
app/(instructor)/home/loading.tsx
app/(instructor)/home/closed/loading.tsx
app/(instructor)/classroom/[id]/loading.tsx
app/(instructor)/classroom/[id]/assignments/loading.tsx
app/(instructor)/classroom/[id]/attendance/loading.tsx
app/(instructor)/classroom/[id]/queue/loading.tsx
app/(instructor)/classroom/[id]/scores/loading.tsx
app/(instructor)/classroom/[id]/approval/loading.tsx
app/(instructor)/classroom/[id]/exam-scores/loading.tsx
app/(instructor)/classroom/[id]/people/loading.tsx
app/(instructor)/classroom/[id]/sections/loading.tsx
app/(instructor)/classroom/[id]/ta-stats/loading.tsx
app/(instructor)/classroom/[id]/activity-log/loading.tsx
app/(instructor)/classroom/[id]/settings/loading.tsx
app/profile/loading.tsx
app/check-in/[sessionId]/loading.tsx
app/queue/book/loading.tsx
app/queue/projector/[sessionId]/loading.tsx
app/attendance/[id]/session/[sessionId]/live/loading.tsx
```

## Recommended error.tsx Routes to Add

```
app/(instructor)/error.tsx
app/(instructor)/classroom/[id]/error.tsx
app/profile/error.tsx
app/check-in/[sessionId]/error.tsx
app/queue/book/error.tsx
app/queue/projector/[sessionId]/error.tsx
app/attendance/[id]/session/[sessionId]/live/error.tsx
```

## Recommended Suspense Boundaries

```
Course Overview: <Suspense fallback={<AnalyticsSkeleton />}><AnalyticsSection /></Suspense>
Admin Dashboard: <Suspense fallback={<ChartSkeleton />}><RecentActivityChart /></Suspense>
Score Summary: <Suspense fallback={<SummarySkeleton />}><ScoreAnalytics /></Suspense>
TA Stats: <Suspense fallback={<ChartSkeleton />}><TAWorkloadCharts /></Suspense>
```

## Recommended Dynamic Imports (Lazy Load)

| Component | Library | Reason |
|---|---|---|
| Recharts charts | recharts | Heavy bundle, not needed on SSR |
| Leaflet map | leaflet/react-leaflet | Browser-only, large |
| Konva canvas | konva/react-konva | Canvas editor, only in classroom layout editor |
| XLSX export | exceljs/xlsx | Only on user action |
| QR code | qrcode.react | Only in check-in/queue pages |
| Firebase setup | firebase | Only after auth |
| Advanced filter panel | — | Only on user open |
| Score import modal | — | Only on user action |

---

## Cache Strategy Summary

| Data | Cache Tag | Cache Life | Notes |
|---|---|---|---|
| Auth session / me | `global:me` | minutes | Invalidate on profile update, logout |
| My courses | `global:my-courses` | minutes | Invalidate on course create/update/member change |
| Course detail | `course:{id}:detail` | hours | Rarely changes |
| Course overview | `course:{id}:overview` | minutes | Invalidate on assignment/score/attendance change |
| Assignments | `course:{id}:assignments` | minutes | Invalidate on any assignment mutation |
| Scores | `course:{id}:scores` | minutes | Invalidate on score create/update/approve |
| Attendance sessions | `course:{id}:attendance` | minutes | Invalidate on session create/update |
| Queue sessions | `course:{id}:queue` | minutes | Invalidate on session state change |
| Score approvals | `course:{id}:score-approvals` | minutes | Invalidate on approve/reject |
| Exam scores | `course:{id}:exams` | minutes | Invalidate on exam mutation |
| People | `course:{id}:people` | minutes | Invalidate on member add/remove |
| Activity log | `course:{id}:activity` | seconds | Short lived, high churn |
| Admin users | `admin:users` | minutes | Invalidate on user CRUD |
| Admin students | `admin:students` | minutes | Invalidate on student CRUD/import |
| Admin courses | `admin:courses` | minutes | Invalidate on course CRUD |
| Admin classrooms | `admin:classrooms` | minutes | Invalidate on classroom CRUD |
| System metrics | — | **no cache** | Live monitoring data |
| Queue live state | — | **no cache** | Real-time |
| Attendance live records | — | **no cache** | Real-time |
| Auth login/refresh | — | **no cache** | Security |

---

## Refactor Implementation Order

1. ✅ Audit (this document)
2. 🔲 Global lib layer: `lib/api/`, `lib/cache/`, `lib/realtime/`
3. 🔲 Shared UI: skeleton system, empty state, error state
4. 🔲 Route loading.tsx and error.tsx
5. 🔲 Fix monitoring endpoint mismatch
6. 🔲 Feature: course-overview (highest impact)
7. 🔲 Feature: assignments
8. 🔲 Feature: scores
9. 🔲 Feature: attendance + live
10. 🔲 Feature: queue + realtime
11. 🔲 Admin pages
12. 🔲 Public pages (check-in, queue booking)
13. 🔲 Cleanup: remove scattered useEffect initial fetching

---

*This document should be updated as refactoring progresses.*
