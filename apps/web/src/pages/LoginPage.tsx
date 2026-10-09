import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginSchema } from '@genuine-homes/shared';
import { authApi } from '@/api/auth';
import { apiErrorMessage } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

export function LoginPage() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const redirectTo = location.state?.from ?? '/dashboard';

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = loginSchema.safeParse({ emailOrPhone, password });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
      }
      return authApi.login(parsed.data);
    },
    onSuccess: (res) => {
      setSession(res);
      toast.success(`Welcome back, ${res.user.fullName.split(' ')[0]}!`);
      navigate(redirectTo, { replace: true });
    },
    onError: (e) => {
      const message = apiErrorMessage(e);
      setError(message);
      toast.error(message);
    },
  });

  return (
    <div className="mx-auto max-w-md animate-slide-up">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-brand-dark">Welcome back</h1>
        <p className="mt-1 text-sm text-stone-500">
          Log in with the email or phone you registered with.
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
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="password">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-brand"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button
            className="btn-primary w-full"
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Signing in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          New here?{' '}
          <Link to="/register" className="font-medium text-brand">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
