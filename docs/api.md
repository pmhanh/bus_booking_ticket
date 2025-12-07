# Bus Ticket Booking – API Overview

Base URL: `http://localhost:3000/api`

## Auth
- `POST /auth/register` – `{ email, password, fullName? }`
- `POST /auth/login` – `{ email, password, remember? }` → `{ user, tokens }`
- `POST /auth/refresh` – `{ refreshToken, userId }` → new tokens
- `POST /auth/forgot` – `{ email }` (sends/reset token)
- `POST /auth/reset` – `{ token, newPassword }`
- `POST /auth/change-password` – auth required, `{ currentPassword, newPassword }`
- `POST /auth/verify-request` – `{ email }`; `POST /auth/verify` – `{ token }`
- `GET /auth/me` – auth required
- Google OAuth: `GET /auth/google/start` (popup), `GET /auth/google/callback`

## Public Trips
- `GET /trips/search` – query: `originId`, `destinationId`, `date`, `startTime`, `endTime`, `minPrice`, `maxPrice`, `busType`, `amenities[]`, `sortBy=price|time|duration`, `sortOrder=asc|desc`, `page`, `limit`
- `GET /trips/:id` – trip detail (includes route, bus, seat map meta)
- `GET /trips/:tripId/seat-map` – seat availability; optional `lockToken` to mark your held seats

## Seat Locking (auth required)
- `POST /trips/:tripId/seat-locks` – body: `{ seats: string[], holdMinutes?, lockToken? }` → returns `lockToken`, `expiresAt`, updated availability
- `PATCH /trips/:tripId/seat-locks/:token` – body `{ holdMinutes? }` to extend
- `DELETE /trips/:tripId/seat-locks/:token` – release lock

## Bookings
- `POST /bookings` – auth required; `{ tripId, seats[], contactName, contactEmail, contactPhone?, passengers?, lockToken? }`
- `POST /bookings/guest` – same payload, no auth
- `POST /bookings/lookup` – `{ reference, email?, phone? }` (guest lookup)
- `GET /bookings/:reference` – get booking
- `PATCH /bookings/:reference/confirm` – auth required; confirm (removes expiry)
- `PATCH /bookings/:reference/cancel` – auth required; cancel
- `GET /bookings/:reference/ticket` – ticket text (active bookings only)
- `POST /bookings/:reference/send-ticket` – send ticket email (confirmed only)

## Admin – Users (auth + role=admin)
- `GET /admin/users`
- `PATCH /admin/users/:id/status` – `{ status: 'active' | 'suspended' }`

## Admin – Cities & Routes
- `GET /admin/cities` / `POST /admin/cities`
- `GET /admin/routes` / `POST /admin/routes`
- `GET /admin/routes/:id` / `PATCH /admin/routes/:id` / `DELETE /admin/routes/:id`

## Admin – Seat Maps
- `GET /admin/seat-maps`
- `GET /admin/seat-maps/:id`
- `POST /admin/seat-maps` – `{ name, rows, cols, seats:[{ code,row,col,price,isActive?,seatType? }] }`
- `PATCH /admin/seat-maps/:id`
- `DELETE /admin/seat-maps/:id`

## Admin – Buses
- `GET /admin/buses`
- `GET /admin/buses/:id`
- `POST /admin/buses` – `{ name, plateNumber, busType?, amenities?, seatMapId? }`
- `PATCH /admin/buses/:id`
- `PATCH /admin/buses/:id/seat-map` – `{ seatMapId: number | null }`

## Admin – Trips
- `GET /admin/trips` – filter by `routeId`, `busId`, `fromDate`, `toDate`, `limit`, `offset`
- `POST /admin/trips` – `{ routeId, busId, departureTime, arrivalTime, basePrice, status? }`
- `GET /admin/trips/:id`
- `PATCH /admin/trips/:id`
- `DELETE /admin/trips/:id`

## Dashboard (sample)
- `GET /dashboard`
- `GET /dashboard/admin-metrics` (admin only)
