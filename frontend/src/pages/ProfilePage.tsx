import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';

export const ProfilePage = () => {
  const { user, refresh, accessToken } = useAuth();
  const [profile, setProfile] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    avatarUrl: user?.avatarUrl || '',
  });
  const [message, setMessage] = useState('');

  const updateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    await apiClient('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setMessage('Profile updated');
    refresh();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card title="Profile">
        <form className="space-y-3" onSubmit={updateProfile}>
          <FormField
            label="Email"
            value={user?.email ?? ''}
            disabled
            className="opacity-60 cursor-not-allowed"
          />
          <FormField
            label="Full name"
            value={profile.fullName}
            onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
          />
          <FormField
            label="Phone"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
          <FormField
            label="Avatar URL"
            value={profile.avatarUrl}
            onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
          />
          <Button type="submit" className="w-full">
            Save changes
          </Button>
        </form>
        {message ? <div className="mt-3 text-success text-sm">{message}</div> : null}
      </Card>
    </div>
  );
};
