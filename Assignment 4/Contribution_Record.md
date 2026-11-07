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

## Charles McCallum

| Group Member Name | What is your contribution? | Discussion Notes |
| --- | --- | --- |
| Charles McCallum | Designed the SQLite schema for the A4 database layer: UserCredentials, UserProfile, Service, Queue, QueueEntry, and Notification, with primary keys, foreign keys, required fields, length limits, and unique and check constraints. Added scrypt password hashing and moved login and registration onto the database so passwords are stored hashed. Moved services, queues, and queue entries from in-memory storage into SQLite. Added tests for each change. | Tommy later added the History table and moved notifications and history onto this schema. |

### Commit evidence

| Commit | Work | Branch |
| --- | --- | --- |
| [596b62d](https://github.com/tommy-truo/queue-smart/commit/596b62d548dae388cc91fe85dea3a770acfe7627) | Added the SQLite schema and schema tests. | `main` |
| [50eeb85](https://github.com/tommy-truo/queue-smart/commit/50eeb8587a17e4c147bcc61627a87f38543db46e) | Added scrypt password hashing helpers and tests. | `main` |
| [14d6cb7](https://github.com/tommy-truo/queue-smart/commit/14d6cb7a0ba42cccd7d178e82328da4d5e22c27b) | Moved auth to SQLite with hashed passwords. | `main` |
| [a4bd24e](https://github.com/tommy-truo/queue-smart/commit/a4bd24e606e6e65072daae75903ed122c6ec4198) | Moved services to SQLite. | `main` |
| [9288669](https://github.com/tommy-truo/queue-smart/commit/92886694a42485baa85a73676017fcd591ed39af) | Moved queues and queue entries to SQLite. | `main` |

## Scope and handoff

- Notifications are stored with user, type, message, timestamp, and status (`sent` or `viewed`). The dashboard still reads the same notification fields.
- History is stored with user, service name, date, and outcome (`served`, `left`, or `removed`). The History screen still reads those fields.
- Tommy's row does not claim the SQLite schema, password hashing, or the move of users, services, and queues into the database. Those are Charles's, in his section above.
- Copy each member's row into the group's final A4 Word/PDF contribution table. Other members should add their own verified contributions; this record is not the complete group submission.
