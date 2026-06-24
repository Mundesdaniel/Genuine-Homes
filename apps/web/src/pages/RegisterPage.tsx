import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  SELF_ASSIGNABLE_ROLES,
  registerSchema,
  type SelfAssignableRole,
} from '@genuine-homes/shared';
import { authApi } from '@/api/auth';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

const ROLE_HINT: Record<SelfAssignableRole, string> = {
  user: 'Looking to rent or buy',
  landlord: 'I rent out property',
  agent: 'I list on behalf of owners',
  developer: 'I sell new developments',
};

export function RegisterPage() {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    role: 'user' as SelfAssignableRole,
  });
  const [error, setError] = useState<string | null>(null);

  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = registerSchema.safeParse({
        ...form,
        email: form.email.trim() === '' ? undefined : form.email,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
      }
      return authApi.register(parsed.data);
    },
    onSuccess: (res) => {
      setSession(res);
      toast.success('Account created — welcome to Genuine Homes!');
      navigate('/dashboard', { replace: true });
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
        <h1 className="text-2xl font-bold text-brand-dark">Create your account</h1>
        <p className="mt-1 text-sm text-stone-500">
          A phone number is all you need — email is optional.
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
            <label className="label" htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              className="input"
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              className="input"
              placeholder="+256700000000"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="email"
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
            <p className="mt-1 text-xs text-stone-400">
              At least 8 characters, with a letter and a number.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="role">
              I am a…
            </label>
            <select
              id="role"
              className="input"
              value={form.role}
              onChange={(e) => update('role', e.target.value)}
            >
              {SELF_ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {titleCase(role)} — {ROLE_HINT[role]}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button
            className="btn-primary w-full"
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
