import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../../../shared/api/api';
import { useToast } from '../../../shared/providers/ToastProvider';

type ProfileForm = {
  fullName: string;
  phone: string;
};

type FieldErrors = {
  fullName?: string;
  phone?: string;
};

export const ProfilePage = () => {
  const { user, refresh, accessToken } = useAuth();
  const { showMessage } = useToast();

  const [profile, setProfile] = useState<ProfileForm>({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfile({
      fullName: user?.fullName || '',
      phone: user?.phone || '',
    });
  }, [user?.fullName, user?.phone]);

  const validate = (next: ProfileForm): FieldErrors => {
    const errors: FieldErrors = {};

    if (!next.fullName.trim()) {
      errors.fullName = 'Vui lòng nhập họ tên';
    } else if (next.fullName.trim().length < 2) {
      errors.fullName = 'Họ tên quá ngắn';
    }

    const phone = next.phone.trim();
    if (phone) {
      const ok = /^(03|05|07|08|09)\d{8}$/.test(phone);
      if (!ok) errors.phone = 'Số điện thoại không hợp lệ (vd: 0987654321 hoặc +84987654321)';
    }

    return errors;
  };

  const isValid = useMemo(() => Object.keys(validate(profile)).length === 0, [profile]);

  const updateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      showMessage({ type: 'error', title: 'Chưa đăng nhập', message: 'Bạn chưa đăng nhập.' });
      return;
    }

    const errors = validate(profile);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      setSaving(true);

      await apiClient('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: profile.fullName.trim(),
          phone: profile.phone.trim(),
        }),
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      showMessage({ type: 'success', title: 'Thành công', message: 'Cập nhật hồ sơ thành công' });
      await refresh();
    } catch (err) {
      const msg =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        'Cập nhật thất bại, vui lòng thử lại';

      showMessage({ type: 'error', title: 'Lỗi', message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card title="Hồ sơ">
        <form className="space-y-3" onSubmit={updateProfile}>
          <FormField label="Email" value={user?.email ?? ''} disabled className="opacity-60 cursor-not-allowed" />

          <FormField
            label="Họ tên"
            value={profile.fullName}
            onChange={(e) => {
              const fullName = e.target.value;
              const next = { ...profile, fullName };
              setProfile(next);

              const errors = validate(next);
              setFieldErrors((prev) => ({ ...prev, fullName: errors.fullName }));
            }}
            onBlur={() => {
              const errors = validate(profile);
              setFieldErrors((prev) => ({ ...prev, fullName: errors.fullName }));
            }}
            error={fieldErrors.fullName}
          />

          <FormField
            label="Số điện thoại"
            value={profile.phone}
            onChange={(e) => {
              const phone = e.target.value;
              const next = { ...profile, phone };
              setProfile(next);

              const errors = validate(next);
              setFieldErrors((prev) => ({ ...prev, phone: errors.phone }));
            }}
            onBlur={() => {
              const errors = validate(profile);
              setFieldErrors((prev) => ({ ...prev, phone: errors.phone }));
            }}
            error={fieldErrors.phone}
            placeholder="vd: 0987654321 hoặc +84987654321"
          />

          <Button type="submit" className="w-full" disabled={!isValid || saving}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
