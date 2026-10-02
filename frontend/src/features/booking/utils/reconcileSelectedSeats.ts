import type { HoldState, SelectedSeat } from '../context/BookingContext';
import type { SeatWithState } from '../../seatmap/types/seatMap';

export function isCurrentSeatHold(
  hold: HoldState,
  tripId: number,
  seats: Pick<SeatWithState, 'code' | 'status'>[],
  now = Date.now(),
) {
  if (
    hold.tripId !== tripId ||
    !(new Date(hold.expiresAt).getTime() > now) ||
    !hold.seatCodes.length
  )
    return false;
  const statuses = new Map(seats.map((seat) => [seat.code, seat.status]));
  return hold.seatCodes.every((code) => statuses.get(code) === 'held');
}

export function reconcileSelectedSeats(
  selected: SelectedSeat[],
  seats: Pick<SeatWithState, 'code' | 'status'>[],
  ownedSeatCodes: string[] = [],
  holdInFlight = false,
) {
  // The server broadcasts a hold before its HTTP response reaches the owner.
  // Wait for that response before deciding whether the hold belongs to someone else.
  if (holdInFlight) return selected;
  const statuses = new Map(seats.map((seat) => [seat.code, seat.status]));
  const owned = new Set(ownedSeatCodes);
  const next = selected.filter(
    ({ code }) =>
      statuses.get(code) === 'available' ||
      (statuses.get(code) === 'held' && owned.has(code)),
  );
  return next.length === selected.length ? selected : next;
}
