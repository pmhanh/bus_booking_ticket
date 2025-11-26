import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { apiClient } from '../lib/api';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await apiClient('/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    setSent(true);
  };

  return (
    <div className="max-w-lg mx-auto min-h-[70vh] flex items-center w-full">
      <Card title="Reset your password" className="w-full">
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
        </form>
        {sent ? (
          <div className="mt-4 text-sm text-success">
            If your account exists, a reset link was sent to your email.
          </div>
        ) : null}
        <div className="mt-4 text-sm text-gray-300 text-center">
          Remembered it?{' '}
          <Link to="/login" className="text-secondary hover:underline">
            Back to login
          </Link>
        </div>
      </Card>
    </div>
  );
};
