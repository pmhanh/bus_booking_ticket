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
  details?: {
    seatCodeSnapshot: string;
    passengerName: string;
    passengerPhone?: string;
    passengerIdNumber?: string;
    priceSnapshot: number;
  }[];
  totalPrice: number;
  status: BookingStatus;
  expiresAt?: string | null;
  checkoutExpiresAt?: string | null;
  refundPending?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type BookingResponse = Omit<Booking, 'passengers'> & {
  passengers?: BookingPassenger[];
};
