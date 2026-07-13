import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api';

const AuthContext = createContext(null);
const LEGACY_STORAGE_KEY = 'scholarslink_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.removeItem(LEGACY_STORAGE_KEY);

    async function restoreSession() {
      try {
        const nextUser = await apiRequest('/auth/me');
        setUser(nextUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function login(email, password) {
    const nextUser = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(nextUser);
    return nextUser;
  }

  async function register(payload) {
    const nextUser = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setUser(nextUser);
    return nextUser;
  }

  async function refreshUser() {
    const nextUser = await apiRequest('/auth/me');
    setUser(nextUser);
    return nextUser;
  }

  async function logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Still clear local auth state if the request fails.
    }
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      refreshUser,
      logout,
      isAuthenticated: Boolean(user),
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

export function dashboardPathForRole(role, user) {
  if (role === 'SUPERVISOR') {
    return '/supervisor';
  }

  if (role === 'ADMIN') {
    return '/admin';
  }

  if (user && user.formsCompleted === false) {
    return '/student/registration';
  }

  return '/student';
}
