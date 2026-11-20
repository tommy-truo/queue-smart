## COSC4353 Software Design Team 39
Fall 2026

## Quick start

Run the API and the frontend together from the repo root:

```
npm run install:all
npm run dev
```

## Frontend

React + TypeScript app built with Vite, in `frontend/`. Login, registration, dashboards, service management, queue screens, notifications, and History call the backend API (start it first, see below); the dev server proxies `/api` to it.

```
cd frontend
npm install
npm run dev
```

Open http://localhost:3939

### Demo login (seed accounts)

| Role     | Email                      | Password      |
| -------- | -------------------------- | ------------- |
| User     | `alex.kim@example.com`     | `UserPass1`   |
| Admin    | `admin@queuesmart.local`   | `AdminPass1`  |
| Employee | `employee@queuesmart.local`| `EmployeePass1` |

Register creates new **user** accounts only.

## Backend

Node + Express + TypeScript API, in `backend/`. Users, services, queues, notifications, and history are in SQLite.

```
cd backend
npm install
npm run dev
```

The API runs on http://localhost:3940. The first start creates `backend/queuesmart.db` with the seed data plus demo data (extra users, two more services, more people in line, and a year of served/left/removed history) so reports have something to show. Delete that file to start fresh. Run tests with `npm test`, or `npm run coverage` for a coverage report.

Requests that need a signed-in user send the `x-user-id` header with the `id` returned by login.

| Method | Path | Who |
| ------ | ---- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | anyone |
| GET | `/api/services` | signed in |
| POST / PUT | `/api/services`, `/api/services/:id` | admin |
| GET | `/api/queues/mine` | user |
| POST | `/api/queues/:serviceId/join`, `/api/queues/:serviceId/leave` | user |
| GET | `/api/queues/:serviceId` | admin, employee |
| POST | `/api/queues/:serviceId/serve-next` | admin, employee |
| POST | `/api/queues/:serviceId/requeue` | admin, employee |
| POST | `/api/queues/:serviceId/entries/:entryId/remove` | admin, employee |
| POST | `/api/queues/:serviceId/entries/:entryId/reorder` | admin |
| GET | `/api/me/notifications` | signed in |
| GET | `/api/me/history` | user |
| GET | `/api/reports/participation`, `/api/reports/services`, `/api/reports/wait-by-hour` | admin |

Reports take optional `from` and `to` (YYYY-MM-DD) and `serviceId` filters. Add `format=csv` to download a CSV file instead of JSON.
