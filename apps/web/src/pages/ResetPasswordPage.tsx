import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { resetPasswordSchema } from '@genuine-homes/shared';
import { authApi } from '@/api/auth';
import { apiErrorMessage } from '@/lib/apiClient';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => {
      if (password !== confirm) {
        throw new Error('Passwords do not match');
      }
      const parsed = resetPasswordSchema.safeParse({ token, password });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
      }
      return authApi.resetPassword(parsed.data);
    },
    onSuccess: () => {
      toast.success('Password updated — log in with your new password');
      navigate('/login', { replace: true });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (!token) {
    return (
      <div className="mx-auto max-w-md animate-slide-up">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-bold text-brand-dark">Invalid reset link</h1>
          <p className="mt-2 text-sm text-stone-500">
            This link is missing its reset token. Request a new one below.
          </p>
          <Link to="/forgot-password" className="btn-primary mt-6 inline-block">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md animate-slide-up">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-brand-dark">Choose a new password</h1>
        <p className="mt-1 text-sm text-stone-500">
          At least 8 characters, with a letter and a number.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
        >
          <div>
            <label className="label" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="confirm">
              Confirm new password
            </label>
            <input
              id="confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button
            className="btn-primary w-full"
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          Link expired?{' '}
          <Link to="/forgot-password" className="font-medium text-brand">
            Request a new one
          </Link>
        </p>
      </div>
    </div>
  );
}
