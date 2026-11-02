import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MyExpenses from './pages/MyExpenses';
import SubmitExpense from './pages/SubmitExpense';
import ExpenseDetail from './pages/ExpenseDetail';
import ManagerInbox from './pages/ManagerInbox';
import TeamExpenses from './pages/TeamExpenses';
import FinanceQueue from './pages/FinanceQueue';
import Reimbursements from './pages/Reimbursements';
import Budgets from './pages/Budgets';
import BudgetDetail from './pages/BudgetDetail';
import PolicyConfig from './pages/PolicyConfig';
import AdminUsers from './pages/AdminUsers';
import AuditReports from './pages/AuditReports';

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-slate-400 font-medium text-sm">Loading SpendWise...</p>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            {/* Public route */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            {/* Authenticated routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager', 'finance', 'admin']}>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager', 'finance', 'admin']}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/expenses"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager', 'admin']}>
                  <MyExpenses />
                </ProtectedRoute>
              }
            />

            <Route
              path="/expenses/new"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager', 'admin']}>
                  <SubmitExpense />
                </ProtectedRoute>
              }
            />

            <Route
              path="/expenses/:id"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager', 'finance', 'admin']}>
                  <ExpenseDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/approvals"
              element={
                <ProtectedRoute allowedRoles={['manager', 'finance', 'admin']}>
                  <ManagerInbox />
                </ProtectedRoute>
              }
            />

            <Route
              path="/team-expenses"
              element={
                <ProtectedRoute allowedRoles={['manager', 'admin']}>
                  <TeamExpenses />
                </ProtectedRoute>
              }
            />

            <Route
              path="/finance/queue"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin']}>
                  <FinanceQueue />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reimbursements"
              element={
                <ProtectedRoute allowedRoles={['finance', 'admin', 'manager']}>
                  <Reimbursements />
                </ProtectedRoute>
              }
            />

            <Route
              path="/budgets"
              element={
                <ProtectedRoute allowedRoles={['manager', 'finance', 'admin']}>
                  <Budgets />
                </ProtectedRoute>
              }
            />

            <Route
              path="/budgets/:id"
              element={
                <ProtectedRoute allowedRoles={['manager', 'finance', 'admin']}>
                  <BudgetDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/policies"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PolicyConfig />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['manager', 'finance', 'admin']}>
                  <AuditReports />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
