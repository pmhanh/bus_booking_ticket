import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useToast } from '../../../shared/providers/ToastProvider';
import { usePasswordValidation } from '../hooks/usePasswordValidation';
import { apiClient } from '../../../shared/api/api';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { showMessage } = useToast();
  const { validatePassword, validateConfirm } = usePasswordValidation();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ token?: string; password?: string; confirm?: string }>({});

  useEffect(() => {
    const t = params.get('token');
    if (t) setToken(t);
  }, [params]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { token?: string; password?: string; confirm?: string } = {};
    if (!token.trim()) nextErrors.token = 'Vui lòng nhập mã xác thực';
    const pwdErr = validatePassword(password);
    if (pwdErr) nextErrors.password = pwdErr;
    const confirmErr = validateConfirm(password, confirm);
    if (confirmErr) nextErrors.confirm = confirmErr;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    await apiClient('/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword: password }),
    });
    showMessage({ type: 'success', title: 'Thành công', message: 'Đổi mật khẩu thành công. Đang chuyển về đăng nhập.' });
    setTimeout(() => navigate('/login'), 1200);
  };

  return (
    <div className="max-w-lg mx-auto min-h-[70vh] flex items-center w-full">
      <Card title="Đặt mật khẩu mới" className="w-full">
        <form onSubmit={onSubmit} className="space-y-4">
          {!token ? (
            <FormField
              label="Mã đặt lại"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              error={fieldErrors.token}
            />
          ) : null}
          <FormField
            label="Mật khẩu mới"
            type="password"
            value={password}
            minLength={8}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            required
            error={fieldErrors.password}
          />
          <FormField
            label="Nhập lại mật khẩu"
            type="password"
            value={confirm}
            minLength={8}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (fieldErrors.confirm) setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
            }}
            required
            error={fieldErrors.confirm}
          />
          <Button type="submit" className="w-full">
            Đặt lại mật khẩu
          </Button>
        </form>
      </Card>
    </div>
  );
};
