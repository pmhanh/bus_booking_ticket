import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';

export const SettingsPage = () => {
  const { accessToken } = useAuth();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const nextErrors: { current?: string; next?: string; confirm?: string } = {};
    if (!pw.current.trim()) nextErrors.current = 'Nhap mat khau hien tai';
    if (!pw.next.trim()) nextErrors.next = 'Nhap mat khau moi';
    if (!pw.confirm.trim()) nextErrors.confirm = 'Nhap lai mat khau moi';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (pw.next !== pw.confirm) {
      setError('New passwords do not match');
      setFieldErrors((prev) => ({ ...prev, confirm: 'Mat khau khong khop' }));
      return;
    }
    if (!accessToken) return;
    await apiClient('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setMessage('Password changed and sessions refreshed');
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
          {error ? <div className="text-error text-sm">{error}</div> : null}
          {message ? <div className="text-success text-sm">{message}</div> : null}
          <Button type="submit" className="w-full">
            Cập nhật mật khẩu
          </Button>
        </form>
      </Card>
    </div>
  );
};
