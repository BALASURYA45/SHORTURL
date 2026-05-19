# SHORTURO

Step-by-step full-stack URL Shortener (React + Node/Express + DB) with authentication and analytics.

## Structure
- `backend/` API + redirect + analytics
- `frontend/` React dashboard
- `docs/` documentation and notes

## Config module (done)
- Env + app config: `backend/src/config/env.js`
- Security + middleware: `backend/src/app.js` (helmet, cors, morgan, JSON)
- Server bootstrap: `backend/src/index.js`
- Example env: `backend/.env.example`

## Database module (done)
- Mongo connection: `backend/src/db.js`
- Models: `backend/src/models/User.js`, `backend/src/models/Link.js`, `backend/src/models/Visit.js`

## Auth module (done)
- Routes: `backend/src/routes/auth.js` (`POST /api/auth/signup`, `POST /api/auth/login`)
- JWT guard: `backend/src/middleware/auth.js`
- Validation: `backend/src/validation/schemas.js`

## User/Access Control + Links Management (done)
- Protected routes: `backend/src/middleware/auth.js`
- Links API: `backend/src/routes/links.js` (`POST /api/links`, `GET /api/links`, `DELETE /api/links/:id`)

## Redirect + Analytics Tracking (done)
- Redirect route: `backend/src/routes/redirect.js` (`GET /:slug`)
- Tracking: increments `Link.clicks`, updates `Link.lastVisitedAt`, and writes `Visit` docs

## Analytics Reporting (done)
- Endpoint: `backend/src/routes/links.js` (`GET /api/links/:id/analytics`)

## Frontend: Auth UI (done)
- React app: `frontend/` (Vite)
- Pages: `frontend/src/pages/Login.jsx`, `frontend/src/pages/Signup.jsx`
- API helper: `frontend/src/lib/api.js` (calls backend auth endpoints)

## Frontend: Routing (done)
- Protected route guard: `frontend/src/components/RequireAuth.jsx`
- Dashboard route: `frontend/src/pages/Dashboard.jsx`

## Frontend: Dashboard (done)
- Links CRUD UI: `frontend/src/pages/Dashboard.jsx` (create/list/delete + copy)

## Frontend: Analytics UI (done)
- Page: `frontend/src/pages/LinkAnalytics.jsx` (`/dashboard/links/:id`)
