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
