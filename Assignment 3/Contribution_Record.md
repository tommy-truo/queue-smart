# Team 39 — Assignment 3 Contribution Record

Repository: https://github.com/tommy-truo/queue-smart

## Pete Sankar

| Group Member Name | What is your contribution? | Discussion Notes |
| --- | --- | --- |
| Pete Sankar | Connected the administrator service screens, user queue joining/leaving, administrator and employee serving, and user history to the existing backend APIs. Added loading, error, Retry, and save feedback; preserved history sorting and pagination; guarded duplicate serving requests. | Reused the team's backend, authentication, API client, and styling. Verified the actual UI flow from joining/leaving and staff serving to the correct user's history, account isolation, pagination, failed-request recovery, and double-click handling. The frontend build and all 67 existing backend tests passed. |

## Commit evidence

| Commit | Work | Branch |
| --- | --- | --- |
| [a76be34](https://github.com/tommy-truo/queue-smart/commit/a76be34) | Connected Service Management and Admin Dashboard to the existing service API, including backend queue counts and open/close actions. | `feat/admin-service-integration` |
| [252236d](https://github.com/tommy-truo/queue-smart/commit/252236d) | Connected History to the signed-in user's backend records, with sorting, pagination, empty/error states, and Retry. | `feat/history-integration` |
| [0c15423](https://github.com/tommy-truo/queue-smart/commit/0c15423) | Connected both user queue screens and both staff queue screens to backend operations that produce history records; removed their mock mutations. | `feat/history-integration` |

Commits use the configured Git author `mcisaura`. The administrator service work and History/queue work are on separate feature branches for review.

## Scope and handoff

- This contribution integrates existing backend APIs; it does not claim authorship of the team's backend modules or existing unit tests.
- Queue reordering, removal, and requeue controls are disabled because corresponding backend operations are not implemented. The User Dashboard remains a separate mock-data integration task.
- Copy Pete's row into the group's final A3 Word/PDF contribution table. Other members should add their own verified contributions; this record is not the complete group submission.
