## COSC4353 Software Design Team 39
Fall 2026

## Frontend

React + TypeScript app built with Vite, in `frontend/`. Queue data is mocked (`src/mock/`); authentication uses mock seeded accounts plus accounts saved in the browser (`localStorage`). There is no backend yet.

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

Register creates new **user** accounts only. The **View as** dropdown in the header still works for quick role switching without a password (demo / development).

## Backend

Node + Express + TypeScript API, in `backend/`. Data is kept in memory (no database yet).

```
cd backend
npm install
npm run dev
```

The API runs on http://localhost:3940. Run tests with `npm test`, or `npm run coverage` for a coverage report.
