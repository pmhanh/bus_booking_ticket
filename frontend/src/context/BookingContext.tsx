import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Trip } from '../types/trip';

export type PassengerForm = {
  seatCode: string;
  name: string;
  phone?: string;
  idNumber?: string;
  price?: number;
};

type SeatSelection = { code: string; price?: number };
type ContactInfo = { name: string; email?: string; phone: string };

type BookingContextValue = {
  trip: Trip | null;
  selectedSeats: SeatSelection[];
  passengers: PassengerForm[];
  contact: ContactInfo;
  totalPrice: number;
  setTrip: (trip: Trip | null) => void;
  toggleSeat: (seat: SeatSelection) => void;
  updatePassenger: (seatCode: string, data: Partial<PassengerForm>) => void;
  setContact: (data: Partial<ContactInfo>) => void;
  clear: () => void;
};

const BookingContext = createContext<BookingContextValue | undefined>(undefined);

export const BookingProvider = ({ children }: PropsWithChildren) => {
  const [trip, setTripState] = useState<Trip | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<SeatSelection[]>([]);
  const [passengers, setPassengers] = useState<PassengerForm[]>([]);
  const [contact, setContactState] = useState<ContactInfo>({ name: '', phone: '' });

  const setTrip = useCallback((next: Trip | null) => {
    setTripState((prev) => {
      if (!next || prev?.id !== next.id) {
        setSelectedSeats([]);
        setPassengers([]);
      }
      return next;
    });
  }, []);

  const toggleSeat = useCallback((seat: SeatSelection) => {
    setSelectedSeats((prev) => {
      const exists = prev.some((s) => s.code === seat.code);
      if (exists) {
        setPassengers((ps) => ps.filter((p) => p.seatCode !== seat.code));
        return prev.filter((s) => s.code !== seat.code);
      }
      setPassengers((ps) => {
        const next = [...ps, { seatCode: seat.code, name: '', price: seat.price }];
        const uniq = new Map(next.map((p) => [p.seatCode, p]));
        return Array.from(uniq.values());
      });
      return [...prev, seat];
    });
  }, []);

  const updatePassenger = useCallback((seatCode: string, data: Partial<PassengerForm>) => {
    setPassengers((prev) => {
      const exists = prev.find((p) => p.seatCode === seatCode);
      if (!exists) return prev;
      return prev.map((p) => (p.seatCode === seatCode ? { ...p, ...data } : p));
    });
  }, []);

  const setContact = useCallback((data: Partial<ContactInfo>) => {
    setContactState((prev) => ({ ...prev, ...data }));
  }, []);

  const clear = useCallback(() => {
    setTripState(null);
    setSelectedSeats([]);
    setPassengers([]);
    setContactState({ name: '', phone: '' });
  }, []);

  const totalPrice = useMemo(() => {
    const base = trip?.basePrice ?? 0;
    return passengers.reduce((sum, p) => sum + (p.price ?? base), 0);
  }, [passengers, trip?.basePrice]);

  const value: BookingContextValue = useMemo(
    () => ({
      trip,
      selectedSeats,
      passengers,
      contact,
      totalPrice,
      setTrip,
      toggleSeat,
      updatePassenger,
      setContact,
      clear,
    }),
    [trip, selectedSeats, passengers, contact, totalPrice, setTrip, toggleSeat, updatePassenger, setContact, clear],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};

export const useBooking = () => {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used inside BookingProvider');
  return ctx;
};
