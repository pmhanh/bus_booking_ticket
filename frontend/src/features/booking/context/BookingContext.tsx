import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

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

type TripLike = any;

type BookingContextValue = {
  trip: TripLike | null;
  setTrip: (trip: TripLike | null) => void;

  selectedSeats: SelectedSeat[];
  setSelectedSeats: React.Dispatch<React.SetStateAction<SelectedSeat[]>>;

  hold: HoldState | null;
  setHold: (hold: HoldState | null) => void;

  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  initPassengersFromSeats: (seatCodes: string[]) => void;
  updatePassenger: (seatCode: string, data: Partial<Omit<Passenger, "seatCode">>) => void;

  contact: Contact;
  setContact: (data: Partial<Contact>) => void;

  totalPrice: number;

  clear: () => void;
};

const BookingContext = createContext<BookingContextValue | null>(null);

const EMPTY_CONTACT: Contact = { name: "", email: "", phone: "" };

export const BookingProvider = ({ children }: { children: React.ReactNode }) => {
  const [trip, _setTrip] = useState<TripLike | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);
  const [hold, _setHold] = useState<HoldState | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [contact, _setContact] = useState<Contact>(EMPTY_CONTACT);

  const setTrip = useCallback((t: TripLike | null) => _setTrip(t), []);

  const setHold = useCallback((h: HoldState | null) => {
    _setHold(h);
  }, []);

  const initPassengersFromSeats = useCallback((seatCodes: string[]) => {
    setPassengers(
      seatCodes.map((seatCode) => ({
        seatCode,
        name: "",
        phone: "",
        idNumber: "",
      })),
    );
  }, []);

  const updatePassenger = useCallback(
    (seatCode: string, data: Partial<Omit<Passenger, "seatCode">>) => {
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

  const clear = useCallback(() => {
    _setTrip(null);
    setSelectedSeats([]);
    _setHold(null);
    setPassengers([]);
    _setContact(EMPTY_CONTACT);
  }, []);

  const value: BookingContextValue = useMemo(
    () => ({
      trip,
      setTrip,
      selectedSeats,
      setSelectedSeats,
      hold,
      setHold,
      passengers,
      setPassengers,
      initPassengersFromSeats,
      updatePassenger,
      contact,
      setContact,
      totalPrice,
      clear,
    }),
    [
      trip,
      setTrip,
      selectedSeats,
      hold,
      setHold,
      passengers,
      initPassengersFromSeats,
      updatePassenger,
      contact,
      setContact,
      totalPrice,
      clear,
    ],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};

export const useBooking = () => {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within BookingProvider");
  return ctx;
};
