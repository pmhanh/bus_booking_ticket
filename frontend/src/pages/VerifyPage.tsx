import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';

export const VerifyPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'idle' | 'verifying' | 'error' | 'done'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const paramToken = params.get('token');
    if (!paramToken) return;
    setStatus('verifying');
    apiClient('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token: paramToken }),
    })
      .then(() => {
        setStatus('done');
        setTimeout(() => navigate('/login'), 800);
      })
      .catch((err: Error) => {
        setError(err.message || 'Verification failed');
        setStatus('error');
      });
  }, [params, navigate]);

  return (
    <div className="max-w-xl mx-auto mt-16 text-center text-white">
      {status === 'verifying' && <div className="text-lg font-semibold">Verifying your email...</div>}
      {status === 'done' && <div className="text-lg font-semibold text-success">Email verified! Redirecting...</div>}
      {status === 'idle' && <div className="text-lg font-semibold">Waiting for verification token...</div>}
      {status === 'error' && <div className="text-lg font-semibold text-error">{error}</div>}
    </div>
  );
};
