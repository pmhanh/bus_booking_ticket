# Bus Ticket Booking ƒ?" API Overview

Base URL: `http://localhost:3000/api`

## Auth
- `POST /auth/register` ƒ?" `{ email, password, fullName? }`
- `POST /auth/login` ƒ?" `{ email, password }` ƒ+' `{ user, accessToken }` (sets `refresh_token` cookie)
- `POST /auth/refresh` ƒ?" (no body) ƒ+' `{ accessToken }` (uses & rotates `refresh_token` cookie)
- `POST /auth/forgot` ƒ?" `{ email }` (sends/reset token)
- `POST /auth/reset` ƒ?" `{ token, newPassword }`
- `POST /auth/change-password` ƒ?" auth required, `{ currentPassword, newPassword }`
- `POST /auth/verify-request` ƒ?" `{ email }`; `POST /auth/verify` ƒ?" `{ token }`
- `GET /auth/me` ƒ?" auth required
- Google OAuth: `GET /auth/google/start` (popup), `GET /auth/google/callback`

## Public Trips
- `GET /trips/search` ƒ?" query: `originId`, `destinationId`, `date`, `startTime`, `endTime`, `minPrice`, `maxPrice`, `busType`, `amenities[]`, `sortBy=price|time|duration`, `sortOrder=asc|desc`, `page`, `limit`
- `GET /trips/:id` ƒ?" trip detail (includes route, bus, seat map meta)
- `GET /trips/:tripId/seat-map` ƒ?" seat availability (booked/inactive vs available)

## Bookings
- `POST /bookings` ƒ?" auth required; `{ tripId, seats[], contactName, contactEmail, contactPhone?, passengers? }`
- `POST /bookings/guest` ƒ?" same payload, no auth
- `POST /bookings/lookup` ƒ?" `{ reference, email?, phone? }` (guest lookup)
- `GET /bookings/:reference` ƒ?" get booking
- `PATCH /bookings/:reference/confirm` ƒ?" auth required; confirm (removes expiry)
- `PATCH /bookings/:reference/cancel` ƒ?" auth required; cancel
- `GET /bookings/:reference/ticket` ƒ?" ticket text (active bookings only)
- `POST /bookings/:reference/send-ticket` ƒ?" send ticket email (confirmed only)

## Admin ƒ?" Users (auth + role=admin)
- `GET /admin/users`
- `PATCH /admin/users/:id/status` ƒ?" `{ status: 'pending' | 'active' | 'banned' }`

## Admin ƒ?" Cities & Routes
- `GET /admin/cities` / `POST /admin/cities`
- `GET /admin/routes` / `POST /admin/routes`
- `GET /admin/routes/:id` / `PATCH /admin/routes/:id` / `DELETE /admin/routes/:id`

## Admin ƒ?" Seat Maps
- `GET /admin/seat-maps`
- `GET /admin/seat-maps/:id`
- `POST /admin/seat-maps` ƒ?" `{ name, rows, cols, seats:[{ code,row,col,price,isActive?,seatType? }] }`
- `PATCH /admin/seat-maps/:id`
- `DELETE /admin/seat-maps/:id`

## Admin ƒ?" Buses
- `GET /admin/buses`
- `GET /admin/buses/:id`
- `POST /admin/buses` ƒ?" `{ name, plateNumber, busType?, amenities?, seatMapId? }`
- `PATCH /admin/buses/:id`
- `PATCH /admin/buses/:id/seat-map` ƒ?" `{ seatMapId: number | null }`

## Admin ƒ?" Trips
- `GET /admin/trips` ƒ?" filter by `routeId`, `busId`, `fromDate`, `toDate`, `limit`, `offset`
- `POST /admin/trips` ƒ?" `{ routeId, busId, departureTime, arrivalTime, basePrice, status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' }`
- `GET /admin/trips/:id`
- `PATCH /admin/trips/:id`
- `DELETE /admin/trips/:id`

## Admin ƒ?" Reports
- `GET /admin/reports/summary` ƒ?" query: `days` (default 7) hoặc `from=YYYY-MM-DD&to=YYYY-MM-DD` (trả `dashboardSummary`, `daily.bookings`, `topRoutes`, `recentBookings`, ...)

## Dashboard (sample)
- `GET /dashboard` (admin only)
- `GET /dashboard/admin-metrics` (admin only)
