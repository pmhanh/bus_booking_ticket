# Bus Ticket Booking – Auth & Dashboard (Week 1)

Monorepo with **frontend (Vite + React + Tailwind)** and **backend (NestJS + Postgres + JWT)** implementing the core authentication/authorization and a dashboard prototype for Assignment 1.

## Quick Start

1. **Backend**
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```
2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The app expects `VITE_API_URL=http://localhost:3000/api`.

## Authentication & Authorization

- **Email/Password**: `POST /api/auth/register` and `POST /api/auth/login` (bcrypt hashed). Account lockout after 5 failed attempts for 15 minutes.
- **Tokens**: Access JWT (15m) + Refresh JWT (7d). Refresh tokens are hashed on the user record; `/api/auth/refresh` exchanges them.
- **Social login (popup)**: `/api/auth/google/start` + `/api/auth/google/callback` used by the frontend popup. (Remove `POST /api/auth/google` if not implemented.)
- **Password reset**: `/api/auth/forgot` issues a 1h reset token (JWT) and logs it (replace with email service). `/api/auth/reset` applies the change and clears refresh tokens. `/api/auth/change-password` for logged-in users.
- **Email verification**: `/api/auth/verify-request` emits a 1h verification token (logged for now). `/api/auth/verify` marks the user as verified.
- **Authorization**: Role-based (`admin | agent | user`) enforced on client routes and server guards (e.g., `/api/admin/users`, `/api/dashboard/admin-metrics`). UI: Dashboard link/admin pages hidden from non-admins; admin is redirected away from user Home.
- **Storage choice**: Short-lived access token in memory; refresh token + userId optionally persisted when “Remember me” is checked. Explains risk trade-off; safer storage via httpOnly cookie can be added later.

## Design System & Layout

- Theme tokens in `tailwind.config.js` (primary/secondary/surface colors, spacing scale, typography).
- Reusable components: `AppShell`, `Card`, `Button`, `FormField`, `ProtectedRoute`.
- Pages:
  - **User Home (`/` or `/home`)**: trip/perk/notification widgets for end users. Hidden from admin (admin is routed to Dashboard).
  - **Admin Dashboard (`/dashboard`)**: KPI cards, booking trend, top routes, recent transactions, alerts/tasks, system health. User-only widgets are removed here.
- Wireframe lives in `design/wireframe.md`. Visual style: dark glassmorphism with blue/cyan gradients and Space Grotesk/Inter typography.

## API Surface (selected)

- `POST /api/auth/register` – create user, returns tokens
- `POST /api/auth/login` – login + lockout handling
- `POST /api/auth/refresh` – access/refresh rotation
- `POST /api/auth/forgot` / `POST /api/auth/reset` – password reset (JWT token demo)
- `POST /api/auth/verify-request` / `POST /api/auth/verify` – email verification flow (token logged for demo)
- `GET /api/auth/google/start` / `GET /api/auth/google/callback` – Google OAuth popup flow
- `POST /api/auth/change-password` – requires `Authorization: Bearer`
- `PUT /api/auth/profile` / `GET /api/auth/me` – profile management
- `GET /api/dashboard` – dashboard widgets
- `GET /api/dashboard/admin-metrics` – admin-only sample
- `GET /api/admin/users` + `PATCH /api/admin/users/:id/status` – user management (admin)

## Tooling

- ESLint + Prettier configured for frontend and backend.
- Husky pre-commit running `lint-staged` (`frontend` and `backend` linters).
- Jest scaffolding present from Nest; add domain tests as features grow.
