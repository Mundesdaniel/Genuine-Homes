import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { changePasswordSchema } from '@genuine-homes/shared';
import { authApi } from '@/api/auth';
import { apiErrorMessage } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

/** A password input with an inline show/hide toggle. */
function PasswordField({
  id,
  label,
  value,
  autoComplete,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="input pr-11"
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-stone-400 transition hover:text-stone-600"
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** A single live-validated requirement line. */
function Rule({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li
      className={`flex items-center gap-2 text-xs transition ${
        met ? 'text-emerald-600' : 'text-stone-400'
      }`}
    >
      <span
        className={`grid h-4 w-4 place-items-center rounded-full border transition ${
          met ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-300'
        }`}
      >
        {met && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {children}
    </li>
  );
}

function ChangePasswordForm() {
  const setSession = useAuthStore((s) => s.setSession);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rules = useMemo(
    () => ({
      length: newPassword.length >= 8,
      letter: /[A-Za-z]/.test(newPassword),
      number: /\d/.test(newPassword),
      match: confirm.length > 0 && newPassword === confirm,
    }),
    [newPassword, confirm],
  );
  const ready =
    currentPassword.length > 0 && rules.length && rules.letter && rules.number && rules.match;

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
      }
      return authApi.changePassword(parsed.data);
    },
    // The API rotates every session and returns a fresh one — adopt it so this
    // tab stays signed in seamlessly.
    onSuccess: (session) => {
      setSession(session);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      toast.success('Password updated');
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <form
      className="card overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        mutation.mutate();
      }}
    >
      <div className="space-y-5 p-6">
        <PasswordField
          id="currentPassword"
          label="Current password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
        />

        <div className="h-px bg-stone-100" />

        <PasswordField
          id="newPassword"
          label="New password"
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
        />

        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <Rule met={rules.length}>At least 8 characters</Rule>
          <Rule met={rules.letter}>Contains a letter</Rule>
          <Rule met={rules.number}>Contains a number</Rule>
          <Rule met={rules.match}>Passwords match</Rule>
        </ul>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>

      <div className="flex items-center justify-end border-t border-stone-100 bg-stone-50/60 px-6 py-4">
        <button className="btn-primary" type="submit" disabled={!ready || mutation.isPending}>
          {mutation.isPending ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="animate-fade-in mx-auto max-w-4xl space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
        <p className="text-sm text-stone-500">
          Manage your account{user?.fullName ? `, ${user.fullName}` : ''} — security and
          sign-in preferences.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {/* Section intro */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand">
              <KeyRound className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <h2 className="text-base font-semibold text-ink">Password</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-stone-500">
            Choose a strong password you don’t use anywhere else.
          </p>
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-stone-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            For your security, changing it signs out every other device. You’ll stay signed in
            here.
          </p>
        </div>

        {/* Form */}
        <div className="md:col-span-2">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
