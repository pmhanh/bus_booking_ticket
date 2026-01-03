import type { Trip } from '../../trip/types/trip';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

export type PaymentStatus = 'INIT' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export type BookingDetail = {
  id: number;
  seatCodeSnapshot: string;
  priceSnapshot: number;
  passengerName: string;
  passengerPhone?: string;
  passengerIdNumber?: string;
  tripSeat: {
    id: number;
    seatCodeSnapshot: string;
    price: number;
    isBooked: boolean;
  };
};

export type Payment = {
  id: string;
  provider: 'MOMO' | 'STRIPE';
  status: PaymentStatus;
  amount: number;
  refundAmount?: number;
  refundReason?: string;
  refundMethod?: 'MANUAL' | 'GATEWAY';
  refundedAt?: string;
  createdAt: string;
};

export type Booking = {
  id: string;
  reference: string;
  trip: Trip;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  totalPrice: number;
  status: BookingStatus;
  details: BookingDetail[];
  createdAt: string;
  updatedAt: string;
  payment?: Payment;
};
