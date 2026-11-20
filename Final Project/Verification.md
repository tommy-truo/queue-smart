# Team 39 — Final Project Verification

Repository: https://github.com/tommy-truo/queue-smart

Checked November 20, 2026, on `pete-branch`, using Node.js 22.23.2. These results include Smart Queue Reminders on `pete-branch`. The contribution record links the QA fixes and reminder implementation to their commits.

## 1. Code Coverage Report

All 234 backend tests in 14 files pass. Output of `npm run coverage` (Vitest with v8):

| Metric | Covered | Percent |
| --- | --- | --- |
| Statements | 778 / 782 | 99.48% |
| Branches | 409 / 415 | 98.55% |
| Functions | 180 / 180 | 100% |
| Lines | 677 / 681 | 99.41% |

The backend enforces an 80% minimum for all four metrics. The HTML coverage report is generated at `backend/coverage/index.html`.

## 2. Integration and Build Checks

| Check | Result |
| --- | --- |
| Backend tests and coverage | 234 tests pass |
| Frontend regression tests | 29 tests in 4 files pass |
| API smoke crawl | 224 HTTP checks pass |
| Chrome reminder walkthrough | Joined with a five-minute reminder, changed it to 15 minutes, dismissed the banner, reloaded, and confirmed the saved notification remains on the dashboard |
| Backend TypeScript check | Pass, including the smoke script |
| Frontend production build | Pass |
| Frontend lint | Pass |
| Backend dependency audit | Zero vulnerabilities reported |
| Frontend dependency audit | Zero vulnerabilities reported |
| Development frontend proxy | Login, session lookup, CSV export, logout, and revoked-session rejection passed after the fixes |
| Development database migration | Original column values and rows preserved across all seven existing tables |

The API crawl starts its own server on an available port and uses a temporary SQLite database. It signs in with real session cookies and checks role permissions, queue operations, staff priority, history, notifications, report exports, invalid requests, service renaming, cross-site rejection, session expiry, and logout. It waits for a real background reminder check without customer requests, then restarts the API and checks persisted reminder preferences, dismissal, account, services, history, and session. It removes its temporary database and processes afterward.

The database backup is stored locally at `backend/backups/pre-qa-fixes-2026-11-19.db` and is excluded from Git. The original assignment records and their historical coverage results have not been overwritten.

## 3. QA Fixes

| Area | Changes verified |
| --- | --- |
| Authentication | User ID headers cannot impersonate accounts. Login creates a hashed server session with an HttpOnly cookie. Expiry, rotation, logout, role checks, and cross-site protection are tested. |
| Account isolation | Cross-tab account changes reset account-scoped content. Responses from an earlier session are discarded, including changes during response decoding. |
| Persistence | Migrations upgrade historical schemas. Related writes roll back on failure. History uses immutable service IDs so future service renames or reused names do not transfer its records. |
| Validation | Nulls and invalid body shapes are rejected. Reordering requires a direction. Report dates must be real, ordered calendar dates, with a single service filter. |
| Priority and queue actions | Customers cannot give themselves higher priority. Staff can assign priority. Stale serve/requeue requests return 409 without changing the wrong customer's state. |
| Reporting | Formula-leading CSV text is neutralized and carriage returns are quoted. The hourly metric says “Visits called.” All-zero chart data renders without a crash. |
| Queue updates | Polling, focus refresh, and manual refresh retain loaded content and discard superseded responses. Staff screens work without a hardcoded seed service ID. |
| UI and accessibility | Queue links preserve service selection. Notification text resets. Sorting works with the keyboard. Confirmation dialogs have accessible names. Unknown routes and rendering failures provide recovery. |

## 4. Smart Feature for the Demo

Smart Queue Reminders use each customer's selected lead time and the current service's elapsed time to send an advance notice when the estimated wait reaches their threshold. The demo uses a six-minute service and a five-minute reminder to show an alert triggering with no staff action after the customer joins. The walkthrough also covers changing the preference, dismissing the banner, and requeueing. See [Smart Queue Reminders](Smart_Reminders.md).

Staff-controlled priority remains available and feeds the live order used by the estimate.

## 5. Reproduce the Checks

Run from the repository root:

```sh
nvm use
npm run install:all
npm --prefix backend run typecheck
npm --prefix backend run coverage
npm --prefix backend run smoke
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend audit
npm --prefix frontend audit
```

Start the application with `npm run dev`; the frontend runs at http://localhost:3939 and the API at http://localhost:3940.

## 6. Remaining Demo and Submission Checks

- Run the complete team demo walkthrough. The November 20 Chrome retest covered the new customer reminder flow. The API crawl covers timer delivery, staff operations, reports, and restart persistence.
- Check narrow-screen layouts and the final visual appearance of staff priority controls and dialogs.
- Download an example CSV from administrator Reports and include it with an explanation of its contents, filters, and administrator-only access in the final submission.
- Capture the current coverage summary for the submission.
- Rehearse login, queue interaction, administrator service/queue management, persistence, reporting, and smart reminders with every group member participating.
- Review the changes on `pete-branch` before merging. The [contribution record](Contribution_Record.md) links the implementation commits.
