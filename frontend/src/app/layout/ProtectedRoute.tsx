import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/context/AuthContext';

export const ProtectedRoute = ({ role }: { role?: string }) => {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'booting') {
    return <div className="p-6 text-center text-white">Đang xác thực phiên...</div>;
  }

  if (status === 'guest') {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!user) {
    return <div className="p-6 text-center text-white">Đang tải thông tin người dùng...</div>;
  }

  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
};
