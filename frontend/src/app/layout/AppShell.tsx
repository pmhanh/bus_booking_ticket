import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../features/auth/context/AuthContext';
import { Button } from '../../shared/components/ui/Button';
import clsx from 'clsx';
import { ToastProvider } from '../../shared/providers/ToastProvider';

export const AppShell = ({ children }: PropsWithChildren) => {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const booting = status === 'booting' || status === 'error';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <ToastProvider>
      <div className="min-h-screen text-gray-100 bg-[#0b1021]">
        <header className="flex items-center justify-between px-6 py-4 sticky top-0 z-50 bg-[#0b1021]/95 border-b border-white/5 backdrop-blur-sm print:hidden">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-white">
            <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary grid place-items-center">
              🚌
            </span>
            <span>BusTicket One</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm uppercase tracking-wide">
            {user?.role === 'admin' ? (
              <>
                <NavItem to="/dashboard" label="Tổng quan" />
                <NavItem to="/admin/bookings" label="Đặt chỗ" />
                <NavItem to="/admin/buses" label="Xe" />
                <NavItem to="/admin/trips" label="Chuyến đi" />
                <NavItem to="/admin/trip-operations" label="Vận hành" />
                <NavItem to="/admin/routes" label="Tuyến đường" />
                <NavItem to="/admin/seat-maps" label="Sơ đồ ghế" />
                <NavItem to="/admin/users" label="Người dùng" />
              </>
            ) : (
              <>
                <NavItem to="/" label="Trang chủ" />
                <NavItem to="/bookings" label="Đặt chỗ" />
              </>
            )}
          </nav>
          <div className="flex items-center gap-3">
            {booting ? (
              <div className="h-10 w-28 rounded-xl bg-white/10 animate-pulse" aria-label="Đang tải phiên đăng nhập" />
            ) : user ? (
              <>
                <div className="relative" ref={menuRef}>
                  <div
                    className="text-right cursor-pointer select-none border border-white/15 rounded-xl px-3 py-2 bg-white/5"
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <div className="text-sm font-semibold">{user.fullName || user.email}</div>
                  </div>
                  <div
                    className={clsx(
                      'absolute right-0 top-full translate-y-1 w-44 rounded-xl bg-surface border border-white/10 shadow-card transition-all',
                      menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
                    )}
                  >
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-white/10 text-sm"
                      onClick={() => navigate('/profile')}
                    >
                      Hồ sơ
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-white/10 text-sm"
                      onClick={() => navigate('/settings')}
                    >
                      Cài đặt
                    </button>
                  </div>
                </div>
                <Button variant="ghost" onClick={logout}>
                  Đăng xuất
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate('/login')}>Đăng nhập</Button>
            )}
          </div>
        </header>
        <main className="w-full px-6 py-10">{children}</main>
        <footer className="text-center text-xs text-gray-500 pb-6"></footer>
      </div>
    </ToastProvider>
  );
};

const NavItem = ({ to, label }: { to: string; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      clsx(
        'px-3 py-1 rounded-full transition-colors',
        isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white',
      )
    }
  >
    {label}
  </NavLink>
);
