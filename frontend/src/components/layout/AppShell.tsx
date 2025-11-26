import { Link, NavLink, useNavigate } from 'react-router-dom';
import { PropsWithChildren, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import clsx from 'clsx';

export const AppShell = ({ children }: PropsWithChildren) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen text-gray-100">
      <header className="glass flex items-center justify-between px-6 py-4 sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-white">
          <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary grid place-items-center">
            🚌
          </span>
          <span>BusTicket One</span>
        </Link>
        {user ? (
          <nav className="flex items-center gap-4 text-sm uppercase tracking-wide">
            {user.role !== 'admin' ? <NavItem to="/" label="Home" /> : null}
            {user.role === 'admin' ? <NavItem to="/dashboard" label="Dashboard" /> : null}
            {user.role === 'admin' && <NavItem to="/admin/users" label="Admin" />}
          </nav>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="relative">
                <div
                  className="text-right cursor-pointer select-none border border-white/15 rounded-xl px-3 py-2 bg-white/5"
                  onClick={() => setMenuOpen((v) => !v)}
                  onMouseEnter={() => setMenuOpen(true)}
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="text-sm font-semibold">{user.fullName || user.email}</div>
                  <div className="text-xs text-gray-400">{user.role}</div>
                </div>
                <div
                  className={clsx(
                    'absolute right-0 mt-2 w-44 rounded-xl bg-surface border border-white/10 shadow-card transition-all',
                    menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
                  )}
                  onMouseEnter={() => setMenuOpen(true)}
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-white/10 text-sm"
                    onClick={() => navigate('/profile')}
                  >
                    Profile
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-white/10 text-sm"
                    onClick={() => navigate('/settings')}
                  >
                    Settings
                  </button>
                </div>
              </div>
              <Button variant="ghost" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <Button onClick={() => navigate('/login')}>Login</Button>
          )}
        </div>
      </header>
      <main className="w-full px-6 py-10">{children}</main>
      <footer className="text-center text-xs text-gray-500 pb-6"></footer>
    </div>
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
