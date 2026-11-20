## COSC4353 Software Design Team 39
Fall 2026

## Requirements

Use Node.js 22.23.2 (`nvm use`); Node 22.22.0 or newer is required.

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

The API runs on http://localhost:3940. The first start creates `backend/queuesmart.db` with the seed data plus demo data (extra users, two more services, more people in line, and a year of served/left/removed history) so reports have something to show. Existing database files are upgraded automatically using transactional, versioned migrations; do not delete the database to upgrade. Back up the file before deployment. History now uses stable service IDs, so future renames preserve report attribution. Legacy history is linked by exact current service name only during migration; unmatched records remain visible in unfiltered participation reports. Names reused before migration cannot be reliably disambiguated from the old data alone. Run tests with `npm test`, or `npm run coverage` for a coverage report.

Login and registration establish an eight-hour server session in an HttpOnly, SameSite cookie. API requests and CSV downloads use this cookie; user ID headers do not authenticate requests. `GET /api/auth/session` returns the current account, and `POST /api/auth/logout` revokes its session. Account changes synchronize across browser tabs.

Serve the frontend and API under the same origin (the Vite development proxy does this). In production, set `NODE_ENV=production`, use HTTPS, and set `APP_ORIGIN` to the exact frontend origin when a reverse proxy changes the API request host. Cross-site mutation requests are rejected.

| Method | Path | Who |
| ------ | ---- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | anyone |
| GET | `/api/auth/session` | signed in |
| POST | `/api/auth/logout` | anyone; revokes the current session |
| GET | `/api/services` | signed in |
| POST / PUT | `/api/services`, `/api/services/:id` | admin |
| GET | `/api/queues` (all open queues with the people in them) | admin |
| GET | `/api/queues/mine` | user |
| POST | `/api/queues/:serviceId/join`, `/api/queues/:serviceId/leave` | user |
| GET | `/api/queues/:serviceId` | admin, employee |
| POST | `/api/queues/:serviceId/serve-next` | admin, employee |
| POST | `/api/queues/:serviceId/requeue` | admin, employee |
| POST | `/api/queues/:serviceId/entries/:entryId/remove` | admin, employee |
| POST | `/api/queues/:serviceId/entries/:entryId/reorder` | admin |
| POST | `/api/queues/:serviceId/entries/:entryId/priority` | admin, employee |
| PUT | `/api/queues/:serviceId/reminder` | user; own current queue visit |
| POST | `/api/queues/:serviceId/reminder/dismiss` | user; own active reminder |
| GET | `/api/me/notifications` | signed in |
| GET | `/api/me/history` | user |
| GET | `/api/reports/participation`, `/api/reports/services`, `/api/reports/wait-by-hour` | admin |

Reports take optional `from` and `to` (YYYY-MM-DD) and `serviceId` filters. Add `format=csv` to download a CSV file instead of JSON.


## Queue behavior and reporting

Customers join at medium priority. Administrators and employees can assign low, medium, or high priority through the queue screen; customers cannot promote themselves through the API. Staff serve/requeue actions include the displayed customer's ID and status so an outdated action is rejected instead of affecting someone else.

Queue screens refresh every five seconds, on focus, and through Refresh controls. Background refreshes preserve the current display. Reports accept valid inclusive date ranges and a single service ID. Outcome counts use the history outcome date; wait statistics use the date/hour of joining. The hourly chart and CSV count **visits called**, including a customer currently being served. CSV text is escaped to prevent spreadsheet formula interpretation.

## Smart queue reminders

Customers choose a 5-, 10-, or 15-minute reminder when joining (default 10) and can change it on Queue Status. The backend recalculates the wait from the current customer's remaining expected service time plus the customers still waiting ahead. Customer screens show a live countdown; idle queues do not count down, and delayed service is identified rather than promising an exact start time.

The server checks reminders at startup, every 30 seconds, and after queue changes. Reaching the selected threshold saves one notification and displays a dismissible banner across customer screens. The banner appears on the next five-second queue refresh. Preferences, sent state, and dismissal survive a restart; staff requeue starts a fresh reminder period. Editing a sent reminder does not resend it. The existing “It's your turn” notification is separate. These reminders replace the earlier position-only “almost up” message; the next-in-line badge remains.

The backend must be running to create timed reminders. A customer can close the browser and see the saved notification on return; this does not send email, SMS, or browser push. See the [smart reminder design and demo](Final%20Project/Smart_Reminders.md).

## API request bodies

The browser sends the session cookie automatically. API clients must retain the cookie returned by login or registration; sending `x-user-id` does not authenticate a request.

| Action | JSON body | Behavior |
| --- | --- | --- |
| Join a queue | `{"reminderMinutes":10}` | Choose 5, 10, or 15 minutes; omitted preference defaults to 10. Creates a medium-priority entry. |
| Change a reminder | `{"entryId":"q2","reminderMinutes":5}` | Change the current visit's preference; stale visits return 409. A sent reminder is not sent again. |
| Dismiss a reminder | `{"notificationId":"n12"}` | Hides that banner and marks its saved notification viewed. A stale reminder returns 409. |
| Assign priority | `{"priority":"high"}` | Administrators and employees may choose `low`, `medium`, or `high`. |
| Reorder an entry | `{"direction":"up"}` | Administrators may choose `up` or `down`; a missing direction is rejected. |
| Serve next or requeue | `{"expectedEntryId":"q2","expectedStatus":"serving"}` | The staff UI sends the displayed entry ID and status. A changed entry returns 409 without mutation. API clients should send both fields; valid statuses are `waiting`, `almost-ready`, and `serving`. |

Malformed request bodies and explicit nulls for nonnullable fields return 400. Service updates may omit fields to keep their current values. Report filters reject impossible dates, reversed ranges, and repeated service IDs. A failed multi-table mutation rolls back its queue, history, notification, or account writes together.

## Verification

```sh
npm --prefix backend run typecheck
npm --prefix backend run coverage
npm --prefix backend run smoke
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Backend coverage enforces an 80% minimum for statements, branches, functions, and lines. Tests use isolated databases; the API smoke crawl starts a disposable server/database and verifies persistence across restart. It includes a real 30-second reminder-worker check and takes about 35 seconds. Frontend tests cover rendering, queue refresh, session changes, stale responses, and accessibility behavior.

## Final project records

- [Final project contribution record](Final%20Project/Contribution_Record.md)
- [Current verification results and demo checks](Final%20Project/Verification.md)
