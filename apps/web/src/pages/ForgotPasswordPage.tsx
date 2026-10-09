import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema } from '@genuine-homes/shared';
import { authApi } from '@/api/auth';
import { apiErrorMessage } from '@/lib/apiClient';

export function ForgotPasswordPage() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = forgotPasswordSchema.safeParse({ emailOrPhone });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
      }
      return authApi.forgotPassword(parsed.data);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-md animate-slide-up">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-brand-dark">Forgot your password?</h1>
        <p className="mt-1 text-sm text-stone-500">
          Enter the email or phone you registered with and we&rsquo;ll send you a
          reset link.
        </p>

        {mutation.isSuccess ? (
          <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
            If an account exists for <strong>{emailOrPhone}</strong>, a password
            reset link is on its way. The link expires in 30 minutes.
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              mutation.mutate();
            }}
          >
            <div>
              <label className="label" htmlFor="emailOrPhone">
                Email or phone
              </label>
              <input
                id="emailOrPhone"
                className="input"
                autoComplete="username"
                placeholder="+256700000003"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
              />
            </div>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button
              className="btn-primary w-full"
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-stone-500">
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-brand">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
