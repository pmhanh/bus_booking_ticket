import type { FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../../../shared/api/api';

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
    setMessage('Cập nhật hồ sơ thành công');
    refresh();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card title="Hồ sơ">
        <form className="space-y-3" onSubmit={updateProfile}>
          <FormField
            label="Email"
            value={user?.email ?? ''}
            disabled
            className="opacity-60 cursor-not-allowed"
          />
          <FormField
            label="Họ tên"
            value={profile.fullName}
            onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
          />
          <FormField
            label="Số điện thoại"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
          <FormField
            label="URL ảnh đại diện"
            value={profile.avatarUrl}
            onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
          />
          <Button type="submit" className="w-full">
            Lưu thay đổi
          </Button>
        </form>
        {message ? <div className="mt-3 text-success text-sm">{message}</div> : null}
      </Card>
    </div>
  );
};
