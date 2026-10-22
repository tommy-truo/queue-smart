# Team 39 — Assignment 3 Contribution Record

Repository: https://github.com/tommy-truo/queue-smart

## Pete Sankar

| Group Member Name | What is your contribution? | Discussion Notes |
| --- | --- | --- |
| Pete Sankar | Connected the administrator service screens, user dashboard, queue joining/leaving, administrator and employee serving, and user history to the existing backend APIs. The user dashboard displays backend queue positions, wait estimates, service counts, and account-specific notifications. Added loading, error, Retry, refresh, and save feedback; preserved history sorting and pagination; guarded duplicate serving requests. | Reused the team's backend, authentication, API client, and styling. Verified the actual UI flow from joining/leaving and staff serving to the correct user's history and dashboard, account isolation, pagination, failed-request recovery, and double-click handling. The frontend build and all 67 existing backend tests passed. |

### Commit evidence

| Commit | Work | Branch |
| --- | --- | --- |
| [a76be34](https://github.com/tommy-truo/queue-smart/commit/a76be34) | Connected Service Management and Admin Dashboard to the existing service API, including backend queue counts and open/close actions. | `pete-a3` |
| [252236d](https://github.com/tommy-truo/queue-smart/commit/252236d) | Connected History to the signed-in user's backend records, with sorting, pagination, empty/error states, and Retry. | `pete-a3` |
| [0c15423](https://github.com/tommy-truo/queue-smart/commit/0c15423) | Connected both user queue screens and both staff queue screens to backend operations that produce history records; removed their mock mutations. | `pete-a3` |

Commits use the configured Git author `mcisaura`. All of this work is consolidated on `pete-a3`, with the original contribution commits preserved.

### Scope and handoff

- This contribution integrates existing backend APIs; it does not claim authorship of the team's backend modules or existing unit tests.
- Copy Pete's row into the group's final A3 Word/PDF contribution table. Other members should add their own verified contributions; this record is not the complete group submission.

## Tommy Truong (GitHub username `tommy-truo`)

| Group Member Name | What is your contribution? | Discussion Notes |
| --- | --- | --- |
| Tommy Truong | Added queue removal for administrators and employees, so staff can take someone off a live queue without marking them served, notifies the person of their removal and adds the removal to their history. Added requeue so staff can send the person being served back into the waiting line, behind others of the same priority, notifying the person and keeping them in the queue. | Reused the existing queue, history, notifications, and role checks. Verified both features with backend tests and in the browser. |

### Commit evidence

| Commit | Work | Branch |
| --- | --- | --- |
| [404115b](https://github.com/tommy-truo/queue-smart/commit/404115b849e1da0427249cdd50580320680e9100) | Added staff removal from a live queue. | `feat/queue-removal` Merged to `main` in pull request #10. |
| [f993f62](https://github.com/tommy-truo/queue-smart/commit/f993f621ecad0d9ed26528f703d9cf4c73a791bf) | Added staff requeue for the person being served. | `feat/requeue` Merged to `main` in pull request #12. |

## Scope and handoff

- Administrators and employees can remove someone from a live queue. Employees remove waiting people. Administrators can also remove the person being served.
- Administrators and employees can requeue the person being served. The employee queue shows the control. The administrator screen does not yet.
