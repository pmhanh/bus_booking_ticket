import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../../../shared/providers/ToastProvider';

type LoginForm = { email: string; password: string };
type FieldErrors = { email?: string; password?: string };

export const LoginPage = () => {
  const { login, googleLogin, user } = useAuth();
  const { showMessage } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Client-side validation: email format + password >= 8
  const validate = (nextForm: LoginForm): FieldErrors => {
    const errors: FieldErrors = {};

    // Email
    const email = nextForm.email.trim();
    if (!email) {
      errors.email = 'Vui lòng nhập email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Email không đúng định dạng';
    }
    // Password
    const password = nextForm.password;
    if (!password.trim()) {
      errors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 8) {
      errors.password = 'Mật khẩu phải có ít nhất 8 ký tự';
    }

    return errors;
  };

  const isValid = useMemo(() => Object.keys(validate(form)).length === 0, [form]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      const loggedInUser = await login(form.email, form.password);
      navigate(loggedInUser.role === 'admin' ? '/dashboard' : '/profile');
    } catch (err) {
      showMessage({
        type: 'error',
        title: 'Đăng nhập thất bại',
        message: (err as any)?.response?.data?.message || (err as Error)?.message,
      });
    }
  };

  const handleGoogle = async () => {
    try {
      const socialUser = await googleLogin();
      navigate(socialUser.role === 'admin' ? '/dashboard' : '/profile');
    } catch (err) {
      showMessage({ type: 'error', title: 'Đăng nhập Google thất bại', message: (err as Error)?.message });
    }
  };

  if (user) return <Navigate to={user.role === 'admin' ? '/dashboard' : '/profile'} replace />;

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
              const email = e.target.value;
              const nextForm = { ...form, email };
              setForm(nextForm);

              const errors = validate(nextForm);
              setFieldErrors((prev) => ({ ...prev, email: errors.email }));
            }}
            onBlur={() => {
              const errors = validate(form);
              setFieldErrors((prev) => ({ ...prev, email: errors.email }));
            }}
            error={fieldErrors.email}
          />

          <FormField
            label="Mật khẩu"
            type="password"
            required
            value={form.password}
            onChange={(e) => {
              const password = e.target.value;
              const nextForm = { ...form, password };
              setForm(nextForm);

              const errors = validate(nextForm);
              setFieldErrors((prev) => ({ ...prev, password: errors.password }));
            }}
            onBlur={() => {
              const errors = validate(form);
              setFieldErrors((prev) => ({ ...prev, password: errors.password }));
            }}
            error={fieldErrors.password}
          />

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={!isValid}>
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