import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../../../shared/providers/ToastProvider';

export const LoginPage = () => {
  const { login, googleLogin, user } = useAuth();
  const { showMessage } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const friendlyLabel = (raw: string) => {
    const normalized = raw.toLowerCase();
    if (normalized.includes('invalid credential')) {
      return 'Email hoặc mật khẩu chưa chính xác. Vui lòng thử lại.';
    }
    return raw;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { email?: string; password?: string } = {};
    if (!form.email.trim()) nextErrors.email = 'Vui lòng nhập email';
    if (!form.password.trim()) nextErrors.password = 'Vui lòng nhập mật khẩu';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      const loggedInUser = await login(form.email, form.password);
      navigate(loggedInUser.role === 'admin' ? '/dashboard' : '/profile');
    } catch (err) {
      const fallback = (err as Error)?.message || 'Đăng nhập thất bại';
      showMessage({ type: 'error', title: 'Đăng nhập thất bại', message: friendlyLabel(fallback) });
    }
  };

  const handleGoogle = async () => {
    try {
      const socialUser = await googleLogin();
      navigate(socialUser.role === 'admin' ? '/dashboard' : '/profile');
    } catch (err) {
      const fallback = (err as Error)?.message || 'Đăng nhập Google thất bại';
      showMessage({ type: 'error', title: 'Đăng nhập Google thất bại', message: friendlyLabel(fallback) });
    }
  };

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-lg mx-auto min-h-[70vh] flex items-center w-full">
      <Card title="Chào mừng bạn quay lại" className="w-full">
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
            label="Mật khẩu"
            type="password"
            required
            value={form.password}
            onChange={(e) => {
              setForm({ ...form, password: e.target.value });
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={fieldErrors.password}
          />
          <div className="flex gap-3">
            <Button type="submit" className="flex-1">
              Đăng nhập
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={handleGoogle}>
              Đăng nhập bằng Google
            </Button>
          </div>
        </form>
        <div className="mt-4 flex justify-between text-sm text-gray-300">
          <Link to="/register" className="text-secondary hover:underline">
            Tạo tài khoản
          </Link>
          <Link to="/forgot" className="text-secondary hover:underline">
            Quên mật khẩu?
          </Link>
        </div>
      </Card>
    </div>
  );
};
