import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { apiClient } from '../lib/api';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ token?: string; password?: string; confirm?: string }>({});
  const passwordRule = /^(?=.*[a-z])(?=.*[A-Z]).{8,}$/;

  useEffect(() => {
    const t = params.get('token');
    if (t) setToken(t);
  }, [params]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const nextErrors: { token?: string; password?: string; confirm?: string } = {};
    if (!token.trim()) nextErrors.token = 'Vui long nhap ma xac thuc';
    if (!password.trim()) nextErrors.password = 'Vui long nhap mat khau moi';
    if (!confirm.trim()) nextErrors.confirm = 'Vui long nhap lai mat khau';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (password !== confirm) {
      setError('Passwords do not match');
      setFieldErrors((prev) => ({ ...prev, confirm: 'Mat khau nhap lai khong khop' }));
      return;
    }
    if (!passwordRule.test(password)) {
      setError('Password must be at least 8 chars, include uppercase and lowercase letters.');
      return;
    }
    await apiClient('/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword: password }),
    });
    setDone(true);
    setTimeout(() => navigate('/login'), 1200);
  };

  return (
    <div className="max-w-lg mx-auto min-h-[70vh] flex items-center w-full">
      <Card title="Choose a new password" className="w-full">
        <form onSubmit={onSubmit} className="space-y-4">
          {!token ? (
            <FormField
              label="Reset token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              error={fieldErrors.token}
            />
          ) : null}
          <FormField
            label="New password"
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
            label="Confirm password"
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
          {error ? <div className="text-error text-sm">{error}</div> : null}
          <Button type="submit" className="w-full">
            Reset password
          </Button>
        </form>
        {done ? <div className="mt-4 text-success text-sm">Password updated. Redirecting to login.</div> : null}
      </Card>
    </div>
  );
};
