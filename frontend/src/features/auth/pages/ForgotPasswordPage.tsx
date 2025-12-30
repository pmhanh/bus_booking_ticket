import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useToast } from '../../../shared/providers/ToastProvider';
import { apiClient } from '../../../shared/api/api';

export const ForgotPasswordPage = () => {
  const { showMessage } = useToast();

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);

  const validateEmail = (value: string) => {
    const v = value.trim();
    if (!v) return 'Vui lòng nhập email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email không đúng định dạng';
    return undefined;
  };

  const isValid = useMemo(() => !validateEmail(email), [email]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const err = validateEmail(email);
    setFieldError(err);
    if (err) return;

    try {
      setSending(true);

      await apiClient('/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });

      showMessage({
        type: 'success',
        title: 'Đã gửi yêu cầu',
        message: 'Liên kết đặt lại đã được gửi tới email của bạn.',
      });
    } catch (error) {
      const msg =
        (error as any)?.response?.data?.message ||
        (error as any)?.message ||
        'Không thể gửi email khôi phục';

      showMessage({ type: 'error', title: 'Gửi thất bại', message: msg });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto min-h-[70vh] flex items-center w-full">
      <Card title="Đặt lại mật khẩu" className="w-full">
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              const v = e.target.value;
              setEmail(v);

              setFieldError(validateEmail(v));
            }}
            onBlur={() => {
              setFieldError(validateEmail(email));
            }}
            error={fieldError}
            placeholder="you@example.com"
          />

          <Button type="submit" className="w-full" disabled={!isValid || sending}>
            {sending ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
          </Button>
        </form>

        <div className="mt-4 text-sm text-gray-300 text-center">
          Nhớ lại mật khẩu rồi?{' '}
          <Link to="/login" className="text-secondary hover:underline">
            Quay lại đăng nhập
          </Link>
        </div>
      </Card>
    </div>
  );
};
