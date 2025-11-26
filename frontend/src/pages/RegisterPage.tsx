import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { useAuth } from '../context/AuthContext';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const passwordRule = /^(?=.*[a-z])(?=.*[A-Z]).{8,}$/;

  const parseErrorMessage = (err: unknown) => {
    const fallback = (err as Error)?.message || 'Đã có lỗi xảy ra';
    try {
      const parsed = JSON.parse(fallback) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) return parsed.message.join(', ');
      if (parsed.message) return parsed.message;
    } catch {
      // ignore parse issues
    }
    return fallback;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!passwordRule.test(form.password)) {
      setError('Mật khẩu cần tối thiểu 8 ký tự, có ít nhất 1 chữ thường và 1 chữ in hoa.');
      return;
    }
    try {
      const message = await register(form);
      const successMessage = message || 'Verification email sent. Please check your inbox.';
      setInfo(successMessage);
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      const message = parseErrorMessage(err) || 'Registration failed';
      setError(message);
    }
  };

  return (
    <div className="max-w-lg mx-auto min-h-[70vh] flex items-center w-full">
      <Card title="Create your account" className="w-full">
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField
            label="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <FormField
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <FormField
            label="Password"
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error ? <div className="text-error text-sm">{error}</div> : null}
          {info ? <div className="text-success text-sm">{info}</div> : null}
          <Button type="submit" className="w-full">
            Register
          </Button>
        </form>
        <div className="mt-4 text-sm text-gray-300 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-secondary hover:underline">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
};
