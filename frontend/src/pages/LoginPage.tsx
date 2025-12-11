import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { login, googleLogin, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const friendlyLabel = (raw: string) => {
    const normalized = raw.toLowerCase();
    if (normalized.includes('invalid credential')) {
      return 'Email hoặc mật khẩu chưa chính xác. Vui lòng thử lại.';
    }
    return raw;
  };

  const parseErrorMessage = (err: unknown) => {
    const fallback = (err as Error)?.message || 'Đã có lỗi xảy ra';
    try {
      const parsed = JSON.parse(fallback) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) return friendlyLabel(parsed.message.join(', '));
      if (parsed.message) return friendlyLabel(parsed.message);
    } catch {
      // ignore parse issues
    }
    return friendlyLabel(fallback);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const nextErrors: { email?: string; password?: string } = {};
    if (!form.email.trim()) nextErrors.email = 'Vui long nhap email';
    if (!form.password.trim()) nextErrors.password = 'Vui long nhap mat khau';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      const loggedInUser = await login(form.email, form.password, form.remember);
      navigate(loggedInUser.role === 'admin' ? '/dashboard' : '/profile');
    } catch (err) {
      const message = parseErrorMessage(err) || 'Login failed';
      setError(message);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      const socialUser = await googleLogin();
      navigate(socialUser.role === 'admin' ? '/dashboard' : '/profile');
    } catch (err) {
      const message = parseErrorMessage(err) || 'Google sign-in failed';
      setError(message);
    }
  };

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-lg mx-auto min-h-[70vh] flex items-center w-full">
      <Card title="Welcome back" className="w-full">
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => {
              setForm({ ...form, email: e.target.value });
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            error={fieldErrors.email}
          />
          <FormField
            label="Password"
            type="password"
            required
            value={form.password}
            onChange={(e) => {
              setForm({ ...form, password: e.target.value });
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={fieldErrors.password}
          />
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(e) => setForm({ ...form, remember: e.target.checked })}
            />
            Remember me
          </label>
          {error ? <div className="text-error text-sm">{error}</div> : null}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1">
              Sign in
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={handleGoogle}>
              Sign in with Google
            </Button>
          </div>
        </form>
        <div className="mt-4 flex justify-between text-sm text-gray-300">
          <Link to="/register" className="text-secondary hover:underline">
            Create account
          </Link>
          <Link to="/forgot" className="text-secondary hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="mt-2 text-xs text-gray-400"></div>
      </Card>
    </div>
  );
};
