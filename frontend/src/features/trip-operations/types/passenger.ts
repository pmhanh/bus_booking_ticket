import type { TripStatus } from '../../trip/types/trip';

export interface Passenger {
  bookingDetailId: number;
  bookingReference: string;
  bookingStatus: string;
  seatCode: string;
  passengerName: string;
  passengerPhone?: string;
  passengerIdNumber?: string;
  checkedInAt?: string | null;
  isCheckedIn: boolean;
}

export interface TripInfo {
  id: number;
  route: {
    id: number;
    name: string;
    originCity: { id: number; name: string };
    destinationCity: { id: number; name: string };
  };
  departureTime: string;
  arrivalTime: string;
  status: TripStatus;
  realStatus?: TripStatus;
  checkInBlockedReason?: string | null;
}

export interface PassengerListResponse {
  trip: TripInfo;
  passengers: Passenger[];
}
