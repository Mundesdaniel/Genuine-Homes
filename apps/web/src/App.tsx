import { Route, Routes } from 'react-router-dom';
import { UserRole } from '@genuine-homes/shared';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminPage } from '@/pages/AdminPage';
import { ChatPage } from '@/pages/ChatPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { HomePage } from '@/pages/HomePage';
import { ListingDetailPage } from '@/pages/ListingDetailPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { LoginPage } from '@/pages/LoginPage';
import { MockCheckoutPage } from '@/pages/MockCheckoutPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PaymentReturnPage } from '@/pages/PaymentReturnPage';
import { PlanDetailPage } from '@/pages/PlanDetailPage';
import { RegisterPage } from '@/pages/RegisterPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="listings/:id" element={<ListingDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
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
          path="admin"
          element={
            <ProtectedRoute requireRole={UserRole.ADMIN}>
              <AdminPage />
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
        <Route
          path="payments/mock-checkout/:paymentId"
          element={
            <ProtectedRoute>
              <MockCheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
