import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute = ({ role }: { role?: string }) => {
  const { user, status } = useAuth();

  if (status === 'booting') {
    return <div className="p-6 text-center text-white">Đang xác thực phiên...</div>;
  }

  if (status === 'guest') {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return <div className="p-6 text-center text-white">Đang tải thông tin người dùng...</div>;
  }

  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
};
