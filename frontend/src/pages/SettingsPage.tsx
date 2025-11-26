import { FormEvent, useState } from 'react';
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

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw.next !== pw.confirm) {
      setError('New passwords do not match');
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
      <Card title="Security">
        <form className="space-y-3" onSubmit={changePassword}>
          <FormField
            label="Current password"
            type="password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
            required
          />
          <FormField
            label="New password"
            type="password"
            value={pw.next}
            minLength={8}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
            required
          />
          <FormField
            label="Confirm new password"
            type="password"
            value={pw.confirm}
            minLength={8}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            required
          />
          {error ? <div className="text-error text-sm">{error}</div> : null}
          {message ? <div className="text-success text-sm">{message}</div> : null}
          <Button type="submit" className="w-full">
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
};
