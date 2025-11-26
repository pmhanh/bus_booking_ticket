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
  const passwordRule = /^(?=.*[a-z])(?=.*[A-Z]).{8,}$/;

  useEffect(() => {
    const t = params.get('token');
    if (t) setToken(t);
  }, [params]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
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
            />
          ) : null}
          <FormField
            label="New password"
            type="password"
            value={password}
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <FormField
            label="Confirm password"
            type="password"
            value={confirm}
            minLength={8}
            onChange={(e) => setConfirm(e.target.value)}
            required
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
