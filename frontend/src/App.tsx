import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { VerifyPage } from './pages/VerifyPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { TripsPage } from './pages/admin/TripsPage';
import { RoutesPage } from './pages/admin/RoutesPage';
import { SeatMapsPage } from './pages/admin/SeatMapsPage';
import { HomePage } from './pages/HomePage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { TripDetailsPage } from './pages/TripDetailsPage';
import { BookingReviewPage } from './pages/BookingReviewPage';
import { BookingTicketPage } from './pages/BookingTicketPage';
import { BookingsPage } from './pages/BookingsPage';
import { SeatSelectionPage } from './pages/SeatSelectionPage';

function App() {
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
        <Route path="/bookings/review" element={<BookingReviewPage />} />
        <Route path="/bookings/:id/ticket" element={<BookingTicketPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route element={<ProtectedRoute role="admin" />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/trips" element={<TripsPage />} />
          <Route path="/admin/routes" element={<RoutesPage />} />
          <Route path="/admin/seat-maps" element={<SeatMapsPage />} />
        </Route>
      </Routes>
    </AppShell>
  );
}

export default App;
