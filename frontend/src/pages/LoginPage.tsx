import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { login, googleLogin, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(form.email, form.password, form.remember);
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message || 'Login failed');
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await googleLogin();
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message || 'Google sign-in failed');
    }
  };

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-lg mx-auto min-h-[70vh] flex items-center w-full">
      <Card title="Welcome back" className="w-full">
        <form onSubmit={onSubmit} className="space-y-4">
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
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={form.remember}
              onChange={(e) => setForm({ ...form, remember: e.target.checked })}
            />
            Remember me
          </label>
          {error ? <div className="text-error text-sm">{error}</div> : null}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1">
              Sign in
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={handleGoogle}>
              Sign in with Google
            </Button>
          </div>
        </form>
        <div className="mt-4 flex justify-between text-sm text-gray-300">
          <Link to="/register" className="text-secondary hover:underline">
            Create account
          </Link>
          <Link to="/forgot" className="text-secondary hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="mt-2 text-xs text-gray-400">
        </div>
      </Card>
    </div>
  );
};
