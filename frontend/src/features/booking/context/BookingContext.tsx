import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { Trip } from '../../trip/types/trip';

export type SelectedSeat = { code: string; price: number };

export type HoldState = {
  tripId: number;
  lockToken: string;
  seatCodes: string[];
  expiresAt: string; // ISO string
};

export type Contact = {
  name: string;
  email: string;
  phone: string;
};

export type Passenger = {
  seatCode: string;
  name: string;
  phone: string;
  idNumber: string;
};

type PendingBooking = { id: string; email: string; phone: string };

type BookingContextValue = {
  trip: Trip | null;
  setTrip: (trip: Trip | null) => void;

  selectedSeats: SelectedSeat[];
  setSelectedSeats: React.Dispatch<React.SetStateAction<SelectedSeat[]>>;

  hold: HoldState | null;
  setHold: (hold: HoldState | null) => void;
  pendingBooking: PendingBooking | null;
  setPendingBooking: (booking: PendingBooking | null) => void;
  resetSelection: () => void;
  changingSeats: boolean;
  setChangingSeats: (changing: boolean) => void;

  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  initPassengersFromSeats: (seatCodes: string[]) => void;
  updatePassenger: (
    seatCode: string,
    data: Partial<Omit<Passenger, 'seatCode'>>,
  ) => void;

  contact: Contact;
  setContact: (data: Partial<Contact>) => void;

  pickupStopId: number | null;
  setPickupStopId: (id: number | null) => void;

  dropoffStopId: number | null;
  setDropoffStopId: (id: number | null) => void;

  totalPrice: number;

  clear: () => void;
};

const BookingContext = createContext<BookingContextValue | null>(null);

const EMPTY_CONTACT: Contact = { name: '', email: '', phone: '' };

export const BookingProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);
  const [hold, _setHold] = useState<HoldState | null>(null);
  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(
    null,
  );
  const [changingSeats, setChangingSeats] = useState(false);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [contact, _setContact] = useState<Contact>(EMPTY_CONTACT);
  const [pickupStopId, setPickupStopId] = useState<number | null>(null);
  const [dropoffStopId, setDropoffStopId] = useState<number | null>(null);

  const setHold = useCallback((h: HoldState | null) => {
    _setHold(h);
    setPendingBooking(null);
  }, []);

  const initPassengersFromSeats = useCallback((seatCodes: string[]) => {
    setPassengers(
      seatCodes.map((seatCode) => ({
        seatCode,
        name: '',
        phone: '',
        idNumber: '',
      })),
    );
  }, []);

  const updatePassenger = useCallback(
    (seatCode: string, data: Partial<Omit<Passenger, 'seatCode'>>) => {
      setPassengers((prev) =>
        prev.map((p) => (p.seatCode === seatCode ? { ...p, ...data } : p)),
      );
    },
    [],
  );

  const setContact = useCallback((data: Partial<Contact>) => {
    _setContact((prev) => ({ ...prev, ...data }));
  }, []);

  const totalPrice = useMemo(() => {
    // Bạn đang tính total theo selectedSeats, OK
    return selectedSeats.reduce((sum, s) => sum + (s.price || 0), 0);
  }, [selectedSeats]);

  const resetSelection = useCallback(() => {
    setSelectedSeats([]);
    _setHold(null);
    setPassengers([]);
    setPendingBooking(null);
  }, []);

  const clear = useCallback(() => {
    setTrip(null);
    resetSelection();
    _setContact(EMPTY_CONTACT);
    setPickupStopId(null);
    setDropoffStopId(null);
  }, [resetSelection]);

  const value: BookingContextValue = useMemo(
    () => ({
      trip,
      setTrip,
      selectedSeats,
      setSelectedSeats,
      hold,
      setHold,
      pendingBooking,
      setPendingBooking,
      resetSelection,
      changingSeats,
      setChangingSeats,
      passengers,
      setPassengers,
      initPassengersFromSeats,
      updatePassenger,
      contact,
      setContact,
      pickupStopId,
      setPickupStopId,
      dropoffStopId,
      setDropoffStopId,
      totalPrice,
      clear,
    }),
    [
      trip,
      setTrip,
      selectedSeats,
      hold,
      setHold,
      pendingBooking,
      resetSelection,
      changingSeats,
      passengers,
      initPassengersFromSeats,
      updatePassenger,
      contact,
      setContact,
      pickupStopId,
      dropoffStopId,
      totalPrice,
      clear,
    ],
  );

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useBooking = () => {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used within BookingProvider');
  return ctx;
};
