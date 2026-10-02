import { getErrorMessage } from '../../../shared/utils/errorMessage';
import { validateEmail } from '../../../shared/utils/validation';
import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
import { Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../../../shared/providers/ToastProvider';
import { safeReturnTo } from '../utils/returnTo';

type LoginForm = { email: string; password: string };
type FieldErrors = { email?: string; password?: string };

export const LoginPage = () => {
  const { login, googleLogin, user } = useAuth();
  const navigate = useNavigate();
  const { showMessage } = useToast();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Client-side validation: email format + password >= 8
  const validate = (nextForm: LoginForm): FieldErrors => {
    const errors: FieldErrors = {};

    // Email
    const emailError = validateEmail(nextForm.email);
    if (emailError) errors.email = emailError;
    // Password
    const password = nextForm.password;
    if (!password.trim()) {
      errors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 8) {
      errors.password = 'Mật khẩu phải có ít nhất 8 ký tự';
    }

    return errors;
  };

  const isValid = Object.keys(validate(form)).length === 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      if (
        axios.isAxiosError<{ code?: string }>(err) &&
        err.response?.data?.code === 'ACCOUNT_BANNED'
      ) {
        navigate('/account-banned', { replace: true });
        return;
      }
      showMessage({
        type: 'error',
        title: 'Đăng nhập thất bại',
        message: getErrorMessage(err, 'Đăng nhập thất bại'),
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleGoogle = () => {
    googleLogin(returnTo ?? '/');
  };

  if (user)
    return (
      <Navigate
        to={returnTo ?? (user.role === 'admin' ? '/dashboard' : '/')}
        replace
      />
    );

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
              setFieldErrors((prev) => ({
                ...prev,
                password: errors.password,
              }));
            }}
            onBlur={() => {
              const errors = validate(form);
              setFieldErrors((prev) => ({
                ...prev,
                password: errors.password,
              }));
            }}
            error={fieldErrors.password}
          />

          <div className="flex gap-3">
            <Button
              type="submit"
              className="flex-1"
              disabled={!isValid || submitting}
            >
              {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={submitting}
              onClick={handleGoogle}
            >
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
