import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute = ({ role }: { role?: string }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6 text-center text-white">Loading session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
};
