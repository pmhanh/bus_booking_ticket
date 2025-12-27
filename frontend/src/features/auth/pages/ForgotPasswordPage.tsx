import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useToast } from '../../../shared/providers/ToastProvider';
import { apiClient } from '../../../shared/api/api';

export const ForgotPasswordPage = () => {
  const { showMessage } = useToast();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFieldError('Vui lòng nhập email');
      return;
    }
    setFieldError('');
    try {
      await apiClient('/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      showMessage({
        type: 'success',
        title: 'Đã gửi yêu cầu',
        message: 'Nếu tài khoản tồn tại, liên kết đặt lại đã được gửi tới email của bạn.',
      });
    } catch (err) {
      const msg = (err as Error)?.message || 'Không thể gửi email khôi phục';
      showMessage({ type: 'error', title: 'Gửi thất bại', message: msg });
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
              setEmail(e.target.value);
              if (fieldError) setFieldError('');
            }}
            error={fieldError}
          />
          <Button type="submit" className="w-full">
            Gửi liên kết đặt lại
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
