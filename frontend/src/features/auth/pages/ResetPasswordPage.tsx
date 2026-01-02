import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import { FormField } from '../../../shared/components/ui/FormField';
import { useToast } from '../../../shared/providers/ToastProvider';
import { usePasswordValidation } from '../hooks/usePasswordValidation';
import { apiClient } from '../../../shared/api/api';

type FieldErrors = { token?: string; password?: string; confirm?: string };

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { showMessage } = useToast();
  const { validatePassword, validateConfirm } = usePasswordValidation();

  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = params.get('token');
    if (t) setToken(t);
  }, [params]);

  const validate = (t: string, p: string, c: string): FieldErrors => {
    const errors: FieldErrors = {};

    if (!t.trim()) errors.token = 'Vui lòng nhập mã đặt lại';

    const pwdErr = validatePassword(p);
    if (pwdErr) errors.password = pwdErr;

    const confirmErr = validateConfirm(p, c);
    if (confirmErr) errors.confirm = confirmErr;

    return errors;
  };

  const isValid = useMemo(() => Object.keys(validate(token, password, confirm)).length === 0, [token, password, confirm]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const errors = validate(token, password, confirm);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      setSaving(true);

      await apiClient('/auth/reset', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim(), newPassword: password }),
      });

      showMessage({
        type: 'success',
        title: 'Thành công',
        message: 'Đổi mật khẩu thành công. Đang chuyển về trang đăng nhập.',
      });

      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      const msg =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        'Không thể đặt lại mật khẩu, vui lòng thử lại';

      showMessage({ type: 'error', title: 'Thất bại', message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto min-h-[70vh] flex items-center w-full">
      <Card title="Đặt mật khẩu mới" className="w-full">
        <form onSubmit={onSubmit} className="space-y-4">
          {/* ✅ Nếu không có token trong URL, cho nhập tay */}
          {!params.get('token') ? (
            <FormField
              label="Mã đặt lại"
              value={token}
              onChange={(e) => {
                const v = e.target.value;
                setToken(v);

                const errors = validate(v, password, confirm);
                setFieldErrors((prev) => ({ ...prev, token: errors.token }));
              }}
              onBlur={() => {
                const errors = validate(token, password, confirm);
                setFieldErrors((prev) => ({ ...prev, token: errors.token }));
              }}
              required
              error={fieldErrors.token}
              placeholder="Dán mã trong email (token)"
            />
          ) : null}

          <FormField
            label="Mật khẩu mới"
            type="password"
            value={password}
            minLength={8}
            onChange={(e) => {
              const v = e.target.value;
              setPassword(v);

              const errors = validate(token, v, confirm);
              setFieldErrors((prev) => ({
                ...prev,
                password: errors.password,
                confirm: errors.confirm,
              }));
            }}
            onBlur={() => {
              const errors = validate(token, password, confirm);
              setFieldErrors((prev) => ({ ...prev, password: errors.password }));
            }}
            required
            error={fieldErrors.password}
            placeholder="Tối thiểu 8 ký tự, có chữ hoa, thường và số"
          />

          <FormField
            label="Nhập lại mật khẩu"
            type="password"
            value={confirm}
            minLength={8}
            onChange={(e) => {
              const v = e.target.value;
              setConfirm(v);

              const errors = validate(token, password, v);
              setFieldErrors((prev) => ({ ...prev, confirm: errors.confirm }));
            }}
            onBlur={() => {
              const errors = validate(token, password, confirm);
              setFieldErrors((prev) => ({ ...prev, confirm: errors.confirm }));
            }}
            required
            error={fieldErrors.confirm}
          />

          <Button type="submit" className="w-full" disabled={!isValid || saving}>
            {saving ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
