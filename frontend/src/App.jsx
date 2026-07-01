import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { OrgProvider } from './context/OrgContext';
import ProtectedRoute from './components/ProtectedRoute';
import Shell from './components/Shell';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import AcceptInvitation from './pages/AcceptInvitation';

import Overview from './pages/Overview';
import Members from './pages/Members';
import Billing from './pages/Billing';
import AuditLog from './pages/AuditLog';
import Settings from './pages/Settings';

import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/invitations/accept" element={<AcceptInvitation />} />

          {/* Protected app — must be logged in */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <OrgProvider>
                  <Shell />
                </OrgProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="members" element={<Members />} />
            <Route path="billing" element={<Billing />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="settings" element={<Settings />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="tasks/:taskId" element={<TaskDetail />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
