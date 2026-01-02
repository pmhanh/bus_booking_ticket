import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../../../shared/providers/ToastProvider';
import { usePasswordValidation } from '../hooks/usePasswordValidation';
import { apiClient } from '../../../shared/api/api';

type PasswordForm = {
  current: string;
  next: string;
  confirm: string;
};

type FieldErrors = {
  current?: string;
  next?: string;
  confirm?: string;
};

export const SettingsPage = () => {
  const { accessToken } = useAuth();
  const { showMessage } = useToast();
  const { validatePassword, validateConfirm } = usePasswordValidation();

  const [pw, setPw] = useState<PasswordForm>({
    current: '',
    next: '',
    confirm: '',
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  // ✅ Client-side validation
  const validate = (next: PasswordForm): FieldErrors => {
    const errors: FieldErrors = {};

    if (!next.current.trim()) {
      errors.current = 'Nhập mật khẩu hiện tại';
    }

    const pwdErr = validatePassword(next.next);
    if (pwdErr) {
      errors.next = pwdErr;
    }

    const confirmErr = validateConfirm(next.next, next.confirm);
    if (confirmErr) {
      errors.confirm = confirmErr;
    }

    return errors;
  };

  const isValid = useMemo(() => Object.keys(validate(pw)).length === 0, [pw]);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      showMessage({
        type: 'error',
        title: 'Chưa đăng nhập',
        message: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.',
      });
      return;
    }

    const errors = validate(pw);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      setSaving(true);

      await apiClient('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: pw.current,
          newPassword: pw.next,
        }),
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      showMessage({
        type: 'success',
        title: 'Đổi mật khẩu thành công',
        message: 'Mật khẩu của bạn đã được cập nhật.',
      });

      setPw({ current: '', next: '', confirm: '' });
      setFieldErrors({});
    } catch (err) {
      const msg =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        'Đổi mật khẩu thất bại, vui lòng thử lại';

      showMessage({ type: 'error', title: 'Lỗi', message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card title="Đổi mật khẩu">
        <form className="space-y-3" onSubmit={changePassword}>
          <FormField
            label="Mật khẩu hiện tại"
            type="password"
            required
            value={pw.current}
            onChange={(e) => {
              const current = e.target.value;
              const next = { ...pw, current };
              setPw(next);

              const errors = validate(next);
              setFieldErrors((prev) => ({ ...prev, current: errors.current }));
            }}
            onBlur={() => {
              const errors = validate(pw);
              setFieldErrors((prev) => ({ ...prev, current: errors.current }));
            }}
            error={fieldErrors.current}
          />

          <FormField
            label="Mật khẩu mới"
            type="password"
            required
            minLength={8}
            value={pw.next}
            onChange={(e) => {
              const nextPassword = e.target.value;
              const next = { ...pw, next: nextPassword };
              setPw(next);

              const errors = validate(next);
              setFieldErrors((prev) => ({ ...prev, next: errors.next }));
            }}
            onBlur={() => {
              const errors = validate(pw);
              setFieldErrors((prev) => ({ ...prev, next: errors.next }));
            }}
            error={fieldErrors.next}
            placeholder="Tối thiểu 8 ký tự, có chữ hoa, thường và số"
          />

          <FormField
            label="Xác nhận mật khẩu mới"
            type="password"
            required
            minLength={8}
            value={pw.confirm}
            onChange={(e) => {
              const confirm = e.target.value;
              const next = { ...pw, confirm };
              setPw(next);

              const errors = validate(next);
              setFieldErrors((prev) => ({ ...prev, confirm: errors.confirm }));
            }}
            onBlur={() => {
              const errors = validate(pw);
              setFieldErrors((prev) => ({ ...prev, confirm: errors.confirm }));
            }}
            error={fieldErrors.confirm}
          />

          <Button type="submit" className="w-full" disabled={!isValid || saving}>
            {saving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
