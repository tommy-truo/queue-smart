# Team 39 Assignment 3

Megan A Cowan (Darkgirl2442), Charles Mccallum (Muuurbles), Pete Sankar (mcisaura), Tommy Truong (tommy-truo)

## 1. GitHub Repository Link
https://github.com/tommy-truo/queue-smart

- Backend code is in `backend/`, unit tests are in `backend/tests/`.
- Run the tests with `npm test` and the coverage report with `npm run coverage` from `backend/`.
- 88 tests pass, with about 99% line coverage.

## 2. Back-End Technologies

**Technologies**

- **Node.js + Express** - Small and simple framework for a REST API. It is the "E" and "N" of the MERN-style stack we planned in Assignment 2, so it fits with our React front end.
- **TypeScript** - The same language as the front end, so the service, queue entry and user types look the same on both sides and mistakes are caught early.
- **Vitest + Supertest** - Vitest runs the unit tests and coverage report with almost no setup. Supertest calls the API routes in the tests without starting a real server.
- **In-memory store** - Users, services, queues, notifications and history are kept in memory, as allowed for this assignment. A database will replace it in Assignment 4.

**How they support our design**

- The backend is split into the same modules as the assignment: authentication, service management, queue management, wait-time estimation, notifications and history. Each module has its own file, and the routes are thin wrappers around them.
- Role checks (user, employee, administrator) are done in middleware, matching the three roles from Assignment 1.
- Every request body is validated for required fields, types and length limits, and invalid input returns a 400 error with a message the front end shows.
- Wait time is rule-based: people ahead × the service's expected duration.
- The A2 front end now calls these APIs instead of using mock data.

## 3. Team Contribution Record

### Megan A Cowan


| Contribution               | Discussion notes                                                                 |
| -------------------------- | -------------------------------------------------------------------------------- |
| Service-based notifications | Admins can set a custom notification message per service, used when someone joins or is close to being served |
| Service Management screen  | Added the notification field to the create and edit service form                 |
| Tests                      | Added service update tests for the notification field and more update scenarios |


### Charles Mccallum


| Contribution               | Discussion notes                                                                 |
| -------------------------- | -------------------------------------------------------------------------------- |
| Backend scaffold           | Express + TypeScript + Vitest setup, error handling and a root `npm run dev` that starts backend and frontend |
| Backend modules            | Authentication, services, queue, wait-time, notifications and history modules with their API routes |
| Validation                 | Required field, type and length checks on every request body                     |
| Unit tests                 | Tests for the core logic, validation rules and API routes                        |
| Login and registration     | Connected the login and register screens to the backend API                       |
| Styling                    | Theme, card layout and a confirm modal in place of browser popups                |


### Pete Sankar


| Contribution               | Discussion notes                                                                 |
| -------------------------- | -------------------------------------------------------------------------------- |
| Admin service screens      | Connected Service Management and Admin Dashboard to the service API, including queue counts and open/close |
| History screen             | Loads the signed-in user's history from the backend, with sorting, pagination and Retry on errors |
| Queue screens              | Connected join/leave and the admin and employee serve actions to the backend, so they produce history records |
| User Dashboard             | Shows backend queue position, wait estimate, service counts and the user's notifications |


### Tommy Truong


| Contribution               | Discussion notes                                                                 |
| -------------------------- | -------------------------------------------------------------------------------- |
| Queue removal              | Staff can remove someone from a live queue without marking them served; they are notified and it is added to their history |
| Requeue                    | Staff can send the person being served back into the line, behind others of the same priority |
| Queue reordering           | Admins can move waiting people up or down in the line                            |
| Admin requeue button       | Added requeue to the Queue Management screen                                     |
