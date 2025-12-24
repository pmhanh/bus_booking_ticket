import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { useAuth } from '../context/AuthContext';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});
  const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

  const parseErrorMessage = (err: unknown) => {
    const fallback = (err as Error)?.message || 'Đã có lỗi xảy ra';
    try {
      const parsed = JSON.parse(fallback) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) return parsed.message.join(', ');
      if (parsed.message) return parsed.message;
    } catch {
      // ignore parse issues
    }
    return fallback;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const nextErrors: { fullName?: string; email?: string; password?: string } = {};
    if (!form.fullName.trim()) nextErrors.fullName = 'Vui lòng nhập họ tên';
    if (!form.email.trim()) nextErrors.email = 'Vui lòng nhập email';
    if (!form.password.trim()) nextErrors.password = 'Vui lòng nhập mật khẩu';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!passwordRule.test(form.password)) {
      setError('Mật khẩu cần tối thiểu 8 ký tự, có chữ thường, chữ hoa và số.');
      return;
    }
    try {
      const message = await register(form);
      const successMessage = message || 'Email xác thực đã được gửi. Vui lòng kiểm tra hộp thư.';
      setInfo(successMessage);
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      const message = parseErrorMessage(err) || 'Đã có lỗi xảy ra';
      setError(message);
    }
  };

  return (
    <div className="max-w-lg mx-auto min-h-[70vh] flex items-center w-full">
      <Card title="Tạo tài khoản" className="w-full">
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField
            label="Họ tên"
            value={form.fullName}
            required
            onChange={(e) => {
              setForm({ ...form, fullName: e.target.value });
              if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
            }}
            error={fieldErrors.fullName}
          />
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
            minLength={8}
            placeholder="Tối thiểu 8 ký tự"
            value={form.password}
            onChange={(e) => {
              setForm({ ...form, password: e.target.value });
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={fieldErrors.password}
          />
          {error ? <div className="text-error text-sm">{error}</div> : null}
          {info ? <div className="text-success text-sm">{info}</div> : null}
          <Button type="submit" className="w-full">
            Đăng ký
          </Button>
        </form>
        <div className="mt-4 text-sm text-gray-300 text-center">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-secondary hover:underline">
            Đăng nhập
          </Link>
        </div>
      </Card>
    </div>
  );
};
