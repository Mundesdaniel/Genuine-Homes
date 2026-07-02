import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { UserRole } from '@genuine-homes/shared';
import { useAuthStore } from '@/store/authStore';

/**
 * Redirects to /login (remembering where you came from) when not signed in.
 * Pass `requireRole` to additionally gate the route by role — a signed-in user
 * who lacks the role is bounced to the home page.
 */
export function ProtectedRoute({
  children,
  requireRole,
}: {
  children: ReactNode;
  requireRole?: UserRole | UserRole[];
}) {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!token) {
    // Keep the query string so intents like /messages?to=…&listingId=… survive login.
    return (
      <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
    );
  }

  if (requireRole) {
    const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!user || !allowed.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
