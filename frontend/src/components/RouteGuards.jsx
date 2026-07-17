import { Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dashboardPathForRole, useAuth } from '../auth';

function AuthLoading() {
  const { t } = useTranslation();
  return <p className="status">{t('auth.checkingSession')}</p>;
}

export function RequireAuth({ roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={dashboardPathForRole(user.role, user)} replace />;
  }

  return <Outlet />;
}

export function PublicOnly() {
  const { user, loading } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (user) {
    return <Navigate to={dashboardPathForRole(user.role, user)} replace />;
  }

  return <Outlet />;
}

export function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={dashboardPathForRole(user.role, user)} replace />;
}
