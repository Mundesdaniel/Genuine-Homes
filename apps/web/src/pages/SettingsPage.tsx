import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { changePasswordSchema } from '@genuine-homes/shared';
import { authApi } from '@/api/auth';
import { apiErrorMessage } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

function ChangePasswordForm() {
  const setSession = useAuthStore((s) => s.setSession);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (newPassword !== confirm) {
        throw new Error('New passwords do not match');
      }
      const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
      }
      return authApi.changePassword(parsed.data);
    },
    // The API rotates every session and hands back a fresh one — adopt it so
    // this tab stays signed in seamlessly.
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
      className="card max-w-md space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        mutation.mutate();
      }}
    >
      <h2 className="text-lg font-semibold text-stone-800">Change password</h2>

      <div>
        <label className="label" htmlFor="currentPassword">
          Current password
        </label>
        <input
          id="currentPassword"
          className="input"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="newPassword">
          New password
        </label>
        <input
          id="newPassword"
          className="input"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-stone-500">
          At least 8 characters, with a letter and a number.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="confirmPassword">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          className="input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button className="btn-primary w-full" type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}

export function SettingsPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Settings</h1>
        <p className="text-sm text-stone-500">Manage your account security.</p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
