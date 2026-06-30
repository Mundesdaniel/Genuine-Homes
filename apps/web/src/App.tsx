import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardPage } from '@/pages/DashboardPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { HomePage } from '@/pages/HomePage';
import { ListingDetailPage } from '@/pages/ListingDetailPage';
import { LoginPage } from '@/pages/LoginPage';
import { MockCheckoutPage } from '@/pages/MockCheckoutPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
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
          path="plans/:id"
          element={
            <ProtectedRoute>
              <PlanDetailPage />
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
