import type { Trip } from '../../trip/types/trip';

export type BookingPassenger = {
  seatCode: string;
  name: string;
  phone?: string;
  idNumber?: string;
  price: number;
};

export type PassengerInput = {
  seatCode?: string;
  name: string;
  phone?: string;
  idNumber?: string;
};

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

export type Booking = {
  id: string;
  reference?: string | null;
  trip: Trip;
  contactName: string;
  contactEmail?: string | null;
  contactPhone: string;
  passengers: BookingPassenger[];
  totalPrice: number;
  status: BookingStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type SeatStatus = {
  code: string;
  row: number;
  col: number;
  price: number;
  isActive: boolean;
  status: 'available' | 'held' | 'booked' | 'inactive';
  bookedBy?: string;
  bookingId?: string;
  expiresAt?: string | null;
};

export type SeatStatusResponse = {
  seatMap: { id: number; name: string; rows: number; cols: number } | null;
  seats: SeatStatus[];
  basePrice: number;
};
