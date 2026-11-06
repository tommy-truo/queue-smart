# Team 39 — Assignment 4 Contribution Record

Repository: https://github.com/tommy-truo/queue-smart

## Tommy Truong (GitHub username `tommy-truo`)

| Group Member Name | What is your contribution? | Discussion Notes |
| --- | --- | --- |
| Tommy Truong | Extended the SQLite schema with a History table for queue outcomes, a notification type column, a longer notification message limit, and a 1–480 minute check on service duration. Moved notifications into the Notification table, mapping unread and read to sent and viewed, and seeded the existing demo notifications. Moved queue history into the History table and seeded the existing demo history. Queue messages now append a service's custom notification only when one is set. | Reused the team's SQLite database, auth, services, and queue modules. Left users, services, and queues on the existing tables. Verified the new checks and that notifications and history remain after closing and reopening the database file. |

### Commit evidence

| Commit | Work | Branch |
| --- | --- | --- |
| [caa5285](https://github.com/tommy-truo/queue-smart/commit/caa5285fc9153a57dcf345578fd1e8460967a507) | Added the History table and tightened the notification and service-duration checks. | `feat/sqlite-schema-gaps` Merged to `main` in pull request #16. |
| [0e41094](https://github.com/tommy-truo/queue-smart/commit/0e410944c66ed82a57958ce7bf455803e6d23185) | Moved notifications into SQLite and stopped storing the word "undefined" when a service has no custom notification. | `feat/persist-notifications` Merged to `main` in pull request #17. |
| [e26aef9](https://github.com/tommy-truo/queue-smart/commit/e26aef984f8f6d72f2691357ca0cf9f8556dedb8) | Moved queue history into SQLite and removed the in-memory history list. | `feat/persist-history` Merged to `main` in pull request #18. |
| [0c3576d](https://github.com/tommy-truo/queue-smart/commit/0c3576dfb9c8c43a9de214f916d6205f3951743a) | Updated the README so it describes the SQLite store. | `feat/persist-history` Merged to `main` in pull request #18. |

## Scope and handoff

- Notifications are stored with user, type, message, timestamp, and status (`sent` or `viewed`). The dashboard still reads the same notification fields.
- History is stored with user, service name, date, and outcome (`served`, `left`, or `removed`). The History screen still reads those fields.
- This contribution does not claim the SQLite schema, password hashing, or the move of users, services, and queues into the database.
- Copy Tommy's row into the group's final A4 Word/PDF contribution table. Other members should add their own verified contributions; this record is not the complete group submission.
