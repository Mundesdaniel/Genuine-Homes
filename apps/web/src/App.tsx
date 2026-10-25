import { Navigate, Route, Routes } from 'react-router-dom';
import { UserRole } from '@genuine-homes/shared';
import { AdminLayout } from '@/components/AdminLayout';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { AdminOverview } from '@/pages/admin/AdminOverview';
import { AdminSubscriptions } from '@/pages/admin/AdminSubscriptions';
import { AdminUsers } from '@/pages/admin/AdminUsers';
import { IdentityQueue } from '@/pages/admin/IdentityQueue';
import { VerificationQueue } from '@/pages/admin/VerificationQueue';
import { BookingsPage } from '@/pages/BookingsPage';
import { ChatPage } from '@/pages/ChatPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { HomePage } from '@/pages/HomePage';
import { IdentityVerificationPage } from '@/pages/IdentityVerificationPage';
import { ListingDetailPage } from '@/pages/ListingDetailPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PaymentReturnPage } from '@/pages/PaymentReturnPage';
import { PlanDetailPage } from '@/pages/PlanDetailPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { ShortLetDashboardPage } from '@/pages/ShortLetDashboardPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="listings/:id" element={<ListingDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="identity"
          element={
            <ProtectedRoute>
              <IdentityVerificationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="favorites"
          element={
            <ProtectedRoute>
              <FavoritesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="payments"
          element={
            <ProtectedRoute>
              <PaymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="messages"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="bookings"
          element={
            <ProtectedRoute>
              <BookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="short-let"
          element={
            // airbnb_agent role (server + client) AND an active subscription
            // (SubscriptionGate shows a "Renew to access" screen otherwise).
            <ProtectedRoute requireRole={UserRole.AIRBNB_AGENT}>
              <SubscriptionGate>
                <ShortLetDashboardPage />
              </SubscriptionGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="plans/:id"
          element={
            <ProtectedRoute>
              <PlanDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="payments/return"
          element={
            <ProtectedRoute>
              <PaymentReturnPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Admin section — its own AdminLayout (sidebar, no user header/footer),
          guarded once for the whole subtree. /admin keeps working (→ overview).
          Non-admins are bounced to home; signed-out users to /login. */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireRole={UserRole.ADMIN}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="verifications" element={<VerificationQueue />} />
        <Route path="identity" element={<IdentityQueue />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        {/* Unknown /admin/* path → overview. */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
