import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomeRedirect, PublicOnly, RequireAuth } from './components/RouteGuards';
import AdminDashboard from './pages/AdminDashboard';
import AdminFormOptionsPage from './pages/admin/AdminFormOptionsPage';
import AdminHourLogsPage from './pages/admin/AdminHourLogsPage';
import AdminJoinRequestsPage from './pages/admin/AdminJoinRequestsPage';
import AdminMembershipsPage from './pages/admin/AdminMembershipsPage';
import AdminPlacementsPage from './pages/admin/AdminPlacementsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import StudentRegistrationForm from './pages/StudentRegistrationForm';
import SupervisorDashboard from './pages/SupervisorDashboard';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />

        <Route element={<PublicOnly />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<RequireAuth roles={['STUDENT']} />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/registration" element={<StudentRegistrationForm />} />
        </Route>

        <Route element={<RequireAuth roles={['SUPERVISOR']} />}>
          <Route path="/supervisor" element={<SupervisorDashboard />} />
        </Route>

        <Route element={<RequireAuth roles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/form-options" element={<AdminFormOptionsPage />} />
          <Route path="/admin/placements" element={<AdminPlacementsPage />} />
          <Route path="/admin/join-requests" element={<AdminJoinRequestsPage />} />
          <Route path="/admin/hour-logs" element={<AdminHourLogsPage />} />
          <Route path="/admin/memberships" element={<AdminMembershipsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
