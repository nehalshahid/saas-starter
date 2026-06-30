import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { OrgProvider } from './context/OrgContext';
import ProtectedRoute from './components/ProtectedRoute';
import Shell from './components/Shell';
import Login from './pages/Login';
import Register from './pages/Register';
import Overview from './pages/Overview';
import Members from './pages/Members';
import Billing from './pages/Billing';
import AuditLog from './pages/AuditLog';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/"
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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
