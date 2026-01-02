import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../../../shared/providers/ToastProvider';
import { usePasswordValidation } from '../hooks/usePasswordValidation';

type RegisterForm = { fullName: string; email: string; password: string };
type FieldErrors = { fullName?: string; email?: string; password?: string };

export const RegisterPage = () => {
  const { register } = useAuth();
  const { showMessage } = useToast();
  const { validatePassword } = usePasswordValidation();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterForm>({ fullName: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // ✅ Client-side validation: fullName required, email format, password rule (hook)
  const validate = (nextForm: RegisterForm): FieldErrors => {
    const errors: FieldErrors = {};

    // Full name
    if (!nextForm.fullName.trim()) errors.fullName = 'Vui lòng nhập họ tên';

    // Email
    const email = nextForm.email.trim();
    if (!email) {
      errors.email = 'Vui lòng nhập email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Email không đúng định dạng';
    }

    // Password (business rule của FE qua hook)
    const pwdError = validatePassword(nextForm.password);
    if (pwdError) errors.password = pwdError;

    return errors;
  };

  // ✅ dùng để disable submit + check nhanh
  const isValid = useMemo(() => Object.keys(validate(form)).length === 0, [form]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      const message = await register(form);
      showMessage({
        type: 'success',
        title: 'Đăng ký thành công',
        message: message || 'Email xác thực đã được gửi. Vui lòng kiểm tra hộp thư.',
      });
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      // Ưu tiên message từ backend nếu có
      const backendMsg =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        'Đăng ký thất bại, vui lòng thử lại';

      showMessage({ type: 'error', title: 'Đăng ký thất bại', message: backendMsg });
    }
  };

  return (
    <div className="max-w-lg mx-auto min-h-[70vh] flex items-center w-full">
      <Card title="Tạo tài khoản" className="w-full">
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField
            label="Họ tên"
            required
            value={form.fullName}
            onChange={(e) => {
              const fullName = e.target.value;
              const nextForm = { ...form, fullName };
              setForm(nextForm);

              // ✅ validate realtime cho riêng field fullName
              const errors = validate(nextForm);
              setFieldErrors((prev) => ({ ...prev, fullName: errors.fullName }));
            }}
            onBlur={() => {
              // ✅ validate khi rời field
              const errors = validate(form);
              setFieldErrors((prev) => ({ ...prev, fullName: errors.fullName }));
            }}
            error={fieldErrors.fullName}
          />

          <FormField
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => {
              const email = e.target.value;
              const nextForm = { ...form, email };
              setForm(nextForm);

              // ✅ validate realtime email
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
            minLength={8}
            placeholder="Tối thiểu 8 ký tự, có chữ hoa, thường và số"
            value={form.password}
            onChange={(e) => {
              const password = e.target.value;
              const nextForm = { ...form, password };
              setForm(nextForm);

              // ✅ validate realtime password bằng hook
              const errors = validate(nextForm);
              setFieldErrors((prev) => ({ ...prev, password: errors.password }));
            }}
            onBlur={() => {
              const errors = validate(form);
              setFieldErrors((prev) => ({ ...prev, password: errors.password }));
            }}
            error={fieldErrors.password}
          />

          <Button type="submit" className="w-full" disabled={!isValid}>
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