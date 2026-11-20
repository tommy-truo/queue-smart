# Team 39 — Final Project Contribution Record

Repository: https://github.com/tommy-truo/queue-smart

## Pete Sankar

| Group Member Name | What is your contribution? | Discussion Notes |
| --- | --- | --- |
| Pete Sankar | Reviewed the integrated application and fixed authentication, persistence, reporting, and queue issues. Replaced user ID headers with server sessions and added logout, expiry, and account synchronization across tabs. Added database migrations, transaction rollback, and stable service references in history. Fixed report validation, CSV formula handling, and the zero-wait chart crash. Connected staff priority controls, added queue refresh and stale-action protection, and corrected service links, form reset, keyboard sorting, dialog labels, and missing-page recovery. Added regression tests, a repeatable API crawl, dependency updates, and runtime documentation. | Extended the team's existing SQLite schema, backend modules, reporting, and React screens. Verified 206 backend tests, 19 frontend tests, 200 HTTP checks, 99.34% backend line coverage, frontend build, backend typecheck, and frontend lint. Both dependency audits reported zero vulnerabilities. The HTTP crawl verifies persistence across an API restart. A final live-browser retest remains pending because browser control was unavailable. |

### Commit evidence

The implementation and verification work is committed on `pete-branch`. These are actual local commit hashes; the GitHub links become available after the branch is pushed. The work has not been merged into `main`.

| Commit | Work | Branch |
| --- | --- | --- |
| [e1993b6](https://github.com/tommy-truo/queue-smart/commit/e1993b6bd32b87dfcdd0b6799b246d8dafa44693) | Pinned the supported Node version for QueueSmart development. | `pete-branch` |
| [58581da](https://github.com/tommy-truo/queue-smart/commit/58581dabb7ca33767482130b9e9536a5317e5e44) | Updated the backend request parser to its patched release. | `pete-branch` |
| [40fd08b](https://github.com/tommy-truo/queue-smart/commit/40fd08b81f62882350a0922d530d71b42132b86e) | Updated frontend tooling and configure React regression tests. | `pete-branch` |
| [dcd45b2](https://github.com/tommy-truo/queue-smart/commit/dcd45b2255570033efb23880228844ef999ee7bd) | Added nested SQLite transactions for atomic mutations. | `pete-branch` |
| [c0bdd79](https://github.com/tommy-truo/queue-smart/commit/c0bdd793a1f96e0068b64210c5197314ca2e8585) | Migrated existing SQLite databases while preserving customer records. | `pete-branch` |
| [48a3f4e](https://github.com/tommy-truo/queue-smart/commit/48a3f4e3f9fe8ad11740f1a236201bcb8217b6a4) | Kept queue history and reports linked to immutable service IDs. | `pete-branch` |
| [9942aa3](https://github.com/tommy-truo/queue-smart/commit/9942aa3c397651f5cdbe3f7680b50aed9eb3915b) | Added rollback for registration when account persistence fails. | `pete-branch` |
| [cf1a23a](https://github.com/tommy-truo/queue-smart/commit/cf1a23ac5373e3596be63e92e1fe773797b05d09) | Made service and queue creation and updates atomic. | `pete-branch` |
| [5ffc916](https://github.com/tommy-truo/queue-smart/commit/5ffc91642c99e9bfa1d42a00433111a847850815) | Added rollback for incomplete queue changes and notifications. | `pete-branch` |
| [cb424fd](https://github.com/tommy-truo/queue-smart/commit/cb424fd3aecfca2ee032c4ffee69928fb205535c) | Rejected null fields and non-object request bodies before mutation. | `pete-branch` |
| [07fc848](https://github.com/tommy-truo/queue-smart/commit/07fc8480a262d0f94673b0f0f597f26d20dcdeba) | Required an explicit direction when reordering queue entries. | `pete-branch` |
| [856957d](https://github.com/tommy-truo/queue-smart/commit/856957d771d806251d478e4d84d0609ebd72116c) | Reserved priority assignment for staff and keep customer joins at medium. | `pete-branch` |
| [1e85a3e](https://github.com/tommy-truo/queue-smart/commit/1e85a3e79bd88c87c8aac85684148c6c886fcac6) | Rejected stale staff serve and requeue requests before changing the line. | `pete-branch` |
| [e064554](https://github.com/tommy-truo/queue-smart/commit/e0645542eb345e956a5cc53ccab47fcd42dc99df) | Validated report calendar dates, range order, and service filters. | `pete-branch` |
| [26c92fa](https://github.com/tommy-truo/queue-smart/commit/26c92fa3569faf90afbef8522a1b3daefff191c7) | Escaped spreadsheet formulas and carriage returns in report CSV files. | `pete-branch` |
| [c3488ea](https://github.com/tommy-truo/queue-smart/commit/c3488ea55cbc8e4d8717d6f83d126d0fb8ea5c6c) | Labeled hourly report counts as visits called. | `pete-branch` |
| [323ac2a](https://github.com/tommy-truo/queue-smart/commit/323ac2aaa1af2d6f9c3f32341bc83a561b670d7c) | Preserved significant password spaces when validating length. | `pete-branch` |
| [f119c52](https://github.com/tommy-truo/queue-smart/commit/f119c5290594c2646e462d59cbd283ac182e80a9) | Replaced user ID headers with expiring server sessions and cookie login. | `pete-branch` |
| [686f0f8](https://github.com/tommy-truo/queue-smart/commit/686f0f850ccfb8a589b99a04f48f0fbab6280a34) | Synchronized account changes across tabs and discard stale session responses. | `pete-branch` |
| [bb2c38d](https://github.com/tommy-truo/queue-smart/commit/bb2c38d6258ec1b6e9c1a28d8711b3f8d25d0562) | Refreshed queues on polling, focus, and demand without blanking loaded data. | `pete-branch` |
| [0c14dc6](https://github.com/tommy-truo/queue-smart/commit/0c14dc6968ce34d1e685bb63b5d84b276d05c9b6) | Opened the selected service queue and remove hardcoded seed service assumptions. | `pete-branch` |
| [485afd0](https://github.com/tommy-truo/queue-smart/commit/485afd0c854df6eb7341c6b2bdabfe992564ac97) | Added staff controls for assigning customer queue priority. | `pete-branch` |
| [537c230](https://github.com/tommy-truo/queue-smart/commit/537c230b434b000b0bdc1c93cfca2b0330b270f0) | Sent displayed customer preconditions with staff serve and requeue actions. | `pete-branch` |
| [a941f68](https://github.com/tommy-truo/queue-smart/commit/a941f68ce67241418d5cdea9806013b553d93633) | Refreshed customer queue positions and account notifications in the dashboard. | `pete-branch` |
| [f07f82c](https://github.com/tommy-truo/queue-smart/commit/f07f82c15f38072a77b28c3d232ec85c23b222b0) | Kept administrator service counts and the live board current. | `pete-branch` |
| [b3c8e35](https://github.com/tommy-truo/queue-smart/commit/b3c8e356c112592b9e1144596b8619b9d9e3c451) | Rendered reports safely when historical average waits are zero. | `pete-branch` |
| [4883375](https://github.com/tommy-truo/queue-smart/commit/4883375aa679ad9f3b2d4b63169fb2ed5dfe00de) | Cleared optional notification text when service forms reset. | `pete-branch` |
| [19ae73a](https://github.com/tommy-truo/queue-smart/commit/19ae73a28073adddc5e9034f2a35e7f670f53811) | Made history sorting operable with the keyboard. | `pete-branch` |
| [d813cdc](https://github.com/tommy-truo/queue-smart/commit/d813cdc6bb7228435d9cbe9611a10c0d1b707327) | Connected confirmation dialogs to accessible titles and descriptions. | `pete-branch` |
| [d5f3d97](https://github.com/tommy-truo/queue-smart/commit/d5f3d97e043262d7dad989f453a201a1de7a60bc) | Added recovery controls instead of a blank screen after render errors. | `pete-branch` |
| [dc66d21](https://github.com/tommy-truo/queue-smart/commit/dc66d2126d79d0ed0e2b55c332529d29a67cfb82) | Provided a recovery page for unknown application routes. | `pete-branch` |
| [9e100b4](https://github.com/tommy-truo/queue-smart/commit/9e100b47750d3037dfff9c08e8b82232e713131d) | Covered report rendering, staff controls, forms, and accessibility regressions. | `pete-branch` |
| [8eaabca](https://github.com/tommy-truo/queue-smart/commit/8eaabcae92fb6abdab54b9bba45f541311fda099) | Tested null validation and invalid reorder requests without state changes. | `pete-branch` |
| [85265f5](https://github.com/tommy-truo/queue-smart/commit/85265f5270e3becf9881fc12975cc8e5a25cda2a) | Tested staff priority assignment and customer priority restrictions. | `pete-branch` |
| [660af49](https://github.com/tommy-truo/queue-smart/commit/660af49481f25ac8225c3f5ba8016ebe0d89c4b9) | Tested rename-safe reporting, report filters, and CSV formula safety. | `pete-branch` |
| [7cba065](https://github.com/tommy-truo/queue-smart/commit/7cba065bdfa6e164b65c50f495b03f8e33bb39b4) | Tested transaction rollback across queue and service mutations. | `pete-branch` |
| [22d982c](https://github.com/tommy-truo/queue-smart/commit/22d982cc0bd2925bdeb040ce8f9900710969ba2d) | Tested stale staff actions including duplicate calls against the same customer. | `pete-branch` |
| [20fdd5a](https://github.com/tommy-truo/queue-smart/commit/20fdd5a0bae25ad2f65cb556de68e52c0dcc0965) | Enforced the backend coverage minimum required for the final project. | `pete-branch` |
| [abc21d2](https://github.com/tommy-truo/queue-smart/commit/abc21d2ceab81169a95fd275e9a4325e397fab70) | Added a disposable 200-check HTTP crawl with restart persistence checks. | `pete-branch` |
| [4a29a1f](https://github.com/tommy-truo/queue-smart/commit/4a29a1f134ffdc20f5cdbb32780c21bfa607b660) | Documented session APIs, staff queue actions, migrations, and verification commands. | `pete-branch` |
| [e3cc1ea](https://github.com/tommy-truo/queue-smart/commit/e3cc1eafd53ee80fd7f29e4442066294d79eb45d) | Recorded final project coverage, QA results, and remaining demo checks. | `pete-branch` |

Commits use the configured Git author `mcisaura`. The branch was renamed from `pete-a3` to `pete-branch`; Pete's earlier contribution commits remain in its history.

### Scope and handoff

- This work extends the existing application. Charles's original SQLite schema, password hashing, reporting module, and live board, Tommy's queue removal/requeue/reordering and persistence work, and Megan's earlier UI and validation contributions remain their work.
- Customers join at medium priority. Administrators and employees can change priority through the queue screen; the server orders waiting customers by priority while keeping the person being served first.
- The database upgrade was checked against a backup: all original values across the seven existing tables were preserved. History from before the upgrade is linked by exact current service name where possible; names reused before migration cannot be reliably disambiguated from the old data alone.
- Current test commands, coverage, and remaining demo checks are in [Verification](Verification.md).
- Copy Pete's row into the group's final Word/PDF contribution table. Other members should add their own verified final-project contributions; this record is not the complete group submission.
