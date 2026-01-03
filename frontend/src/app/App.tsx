import { Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { ProtectedRoute } from './layout/ProtectedRoute';
import { useAuth } from '../features/auth/context/AuthContext';
import { DashboardPage } from '../features/admin/pages/DashboardPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { ProfilePage } from '../features/auth/pages/ProfilePage';
import { VerifyPage } from '../features/auth/pages/VerifyPage';
import { SettingsPage } from '../features/auth/pages/SettingsPage';
import { AdminUsersPage } from '../features/admin/pages/AdminUsersPage';
import { AdminTripsPage } from '../features/trip/pages/AdminTripsPage';
import { AdminRoutesPage } from '../features/route/pages/AdminRoutesPage';
import { AdminSeatMapsPage } from '../features/seatmap/pages/AdminSeatMapsPage';
import { AdminBusesPage } from '../features/bus/pages/AdminBusesPage';
import { AdminBookingsPage } from '../features/admin-bookings/pages/AdminBookingsPage';
import { AdminReportsPage } from '../features/admin-reports/pages/AdminReportsPage';
import { TripOperationsPage } from '../features/trip-operations/pages/TripOperationsPage';
import { HomePage } from '../features/booking/pages/HomePage';
import { SearchResultsPage } from '../features/booking/pages/SearchResultsPage';
import { TripDetailsPage } from '../features/trip/pages/TripDetailsPage';
import { BookingReviewPage } from '../features/booking/pages/BookingReviewPage';
import { BookingTicketPage } from '../features/booking/pages/BookingTicketPage';
import { BookingsPage } from '../features/booking/pages/BookingsPage';
import { SeatSelectionPage } from '../features/booking/pages/SeatSelectionPage';
import { BookingPassengersPage } from '../features/booking/pages/BookingPassengersPage';
import { StripeCancelPage, StripeSuccessPage } from '../features/payments/pages/StripeResultPage';

function App() {
  const { status } = useAuth();

  if (status === 'booting') {
    return (
      <AppShell>
        <div className="py-16 text-center text-white"></div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/trips/:id" element={<TripDetailsPage />} />
        <Route path="/trips/:id/select-seats" element={<SeatSelectionPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot" element={<ForgotPasswordPage />} />
        <Route path="/reset" element={<ResetPasswordPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/bookings/passengers" element={<BookingPassengersPage />} />
        <Route path="/bookings/review" element={<BookingReviewPage />} />
        <Route path="/bookings/:id/ticket" element={<BookingTicketPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route element={<ProtectedRoute role="admin" />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/bookings" element={<AdminBookingsPage />} />
          <Route path="/admin/buses" element={<AdminBusesPage />} />
          <Route path="/admin/trips" element={<AdminTripsPage />} />
          <Route path="/admin/routes" element={<AdminRoutesPage />} />
          <Route path="/admin/seat-maps" element={<AdminSeatMapsPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/trip-operations" element={<TripOperationsPage />} />
        </Route>

        <Route path="/payments/stripe/success" element={<StripeSuccessPage />} />
        <Route path="/payments/stripe/cancel" element={<StripeCancelPage />} />

      </Routes>
    </AppShell>
  );
}

export default App;
