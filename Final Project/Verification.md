# Team 39 — Final Project Verification

Repository: https://github.com/tommy-truo/queue-smart

Checked November 19, 2026, on `pete-branch`, using Node.js 22.23.2. These results cover the committed implementation on `pete-branch`, based on `b53d621`. The contribution record links each fix to its commit.

## 1. Code Coverage Report

All 206 backend tests in 13 files pass. Output of `npm run coverage` (Vitest with v8):

| Metric | Covered | Percent |
| --- | --- | --- |
| Statements | 698 / 702 | 99.43% |
| Branches | 336 / 342 | 98.24% |
| Functions | 162 / 162 | 100% |
| Lines | 608 / 612 | 99.34% |

The backend enforces an 80% minimum for all four metrics. The HTML coverage report is generated at `backend/coverage/index.html`.

## 2. Integration and Build Checks

| Check | Result |
| --- | --- |
| Backend tests and coverage | 206 tests pass |
| Frontend regression tests | 19 tests in 3 files pass |
| API smoke crawl | 200 HTTP checks pass |
| Backend TypeScript check | Pass, including the smoke script |
| Frontend production build | Pass |
| Frontend lint | Pass |
| Backend dependency audit | Zero vulnerabilities reported |
| Frontend dependency audit | Zero vulnerabilities reported |
| Development frontend proxy | Login, session lookup, CSV export, logout, and revoked-session rejection passed after the fixes |
| Development database migration | Original column values and rows preserved across all seven existing tables |

The API crawl starts its own server on an available port and uses a temporary SQLite database. It signs in with real session cookies and checks role permissions, queue operations, staff priority, history, notifications, report exports, invalid requests, service renaming, cross-site rejection, session expiry, and logout. It restarts the API and confirms that the account, services, history, and session persist. It removes its temporary database and processes afterward.

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

Staff-controlled priority handling uses explicit rules: high priority precedes medium, medium precedes low, and the person being served remains first. Customers cannot promote themselves. Staff can assign priority through the administrator or employee queue screen, and customers receive updated positions and wait estimates as the queue refreshes.

Demonstrate this by joining a service with two customer accounts, assigning the later arrival high priority as staff, and showing the changed order and customer status. Explain the operational reason for assigning priority and how it helps staff handle exceptions consistently.

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

- Repeat the live-browser walkthrough after browser control is available. The initial QA visited all 11 screens, but the final post-fix browser retest could not run because browser control was unavailable. The automated component/API checks above are complete.
- Check narrow-screen layouts and the final visual appearance of staff priority controls and dialogs.
- Download an example CSV from administrator Reports and include it with an explanation of its contents, filters, and administrator-only access in the final submission.
- Capture the current coverage summary for the submission.
- Rehearse login, queue interaction, administrator service/queue management, persistence, reporting, and priority handling with every group member participating.
- Push and review the committed work before merging. The [contribution record](Contribution_Record.md) contains the local commit hashes; its GitHub links become available after the branch is pushed.
