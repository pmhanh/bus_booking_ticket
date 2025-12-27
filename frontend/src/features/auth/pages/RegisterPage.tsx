import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../../../shared/providers/ToastProvider';
import { usePasswordValidation } from '../hooks/usePasswordValidation';

export const RegisterPage = () => {
  const { register } = useAuth();
  const { showMessage } = useToast();
  const { validatePassword } = usePasswordValidation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { fullName?: string; email?: string; password?: string } = {};
    if (!form.fullName.trim()) nextErrors.fullName = 'Vui lòng nhập họ tên';
    if (!form.email.trim()) nextErrors.email = 'Vui lòng nhập email';
    const pwdError = validatePassword(form.password);
    if (pwdError) nextErrors.password = pwdError;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      const message = await register(form);
      showMessage({
        type: 'success',
        title: 'Đăng ký thành công',
        message: message || 'Email xác thực đã được gửi. Vui lòng kiểm tra hộp thư.',
      });
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      const msg = (err as Error)?.message || 'Đăng ký thất bại, vui lòng thử lại';
      showMessage({ type: 'error', title: 'Đăng ký thất bại', message: msg });
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
            placeholder="Tối thiểu 8 ký tự, có chữ hoa, thường và số"
            value={form.password}
            onChange={(e) => {
              setForm({ ...form, password: e.target.value });
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={fieldErrors.password}
          />
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
