import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../../../shared/providers/ToastProvider';
import { usePasswordValidation } from '../hooks/usePasswordValidation';
import { apiClient } from '../../../shared/api/api';

export const SettingsPage = () => {
  const { accessToken } = useAuth();
  const { showMessage } = useToast();
  const { validatePassword, validateConfirm } = usePasswordValidation();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { current?: string; next?: string; confirm?: string } = {};
    if (!pw.current.trim()) nextErrors.current = 'Nhập mật khẩu hiện tại';
    const pwdErr = validatePassword(pw.next);
    if (pwdErr) nextErrors.next = pwdErr;
    const confirmErr = validateConfirm(pw.next, pw.confirm);
    if (confirmErr) nextErrors.confirm = confirmErr;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!accessToken) return;

    await apiClient('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    showMessage({ type: 'success', title: 'Đổi mật khẩu', message: 'Mật khẩu đã được cập nhật.' });
    setPw({ current: '', next: '', confirm: '' });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card title="Đổi mật khẩu">
        <form className="space-y-3" onSubmit={changePassword}>
          <FormField
            label="Mật khẩu hiện tại"
            type="password"
            value={pw.current}
            onChange={(e) => {
              setPw({ ...pw, current: e.target.value });
              if (fieldErrors.current) setFieldErrors((prev) => ({ ...prev, current: undefined }));
            }}
            required
            error={fieldErrors.current}
          />
          <FormField
            label="Mật khẩu mới"
            type="password"
            value={pw.next}
            minLength={8}
            onChange={(e) => {
              setPw({ ...pw, next: e.target.value });
              if (fieldErrors.next) setFieldErrors((prev) => ({ ...prev, next: undefined }));
            }}
            required
            error={fieldErrors.next}
          />
          <FormField
            label="Xác nhận mật khẩu mới"
            type="password"
            value={pw.confirm}
            minLength={8}
            onChange={(e) => {
              setPw({ ...pw, confirm: e.target.value });
              if (fieldErrors.confirm) setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
            }}
            required
            error={fieldErrors.confirm}
          />
          <Button type="submit" className="w-full">
            Cập nhật mật khẩu
          </Button>
        </form>
      </Card>
    </div>
  );
};
