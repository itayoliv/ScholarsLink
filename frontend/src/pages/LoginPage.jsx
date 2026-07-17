import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import { apiRequest } from '../api';
import { dashboardPathForRole, useAuth } from '../auth';

const emptyRegister = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'STUDENT',
};

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState(emptyRegister);

  useEffect(() => {
    let cancelled = false;

    apiRequest('/health')
      .then((data) => {
        if (!cancelled) {
          setDemoMode(Boolean(data.demoMode));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDemoMode(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const user = await login(loginForm.email, loginForm.password);
      navigate(dashboardPathForRole(user.role, user));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const user = await register(registerForm);
      navigate(dashboardPathForRole(user.role, user));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout
      title={t('login.title')}
      subtitle={t('login.subtitle')}
    >
      <div className="auth-grid">
        <section className="panel">
          <div className="tabs">
            <button
              type="button"
              className={mode === 'login' ? '' : 'secondary'}
              onClick={() => setMode('login')}
            >
              {t('login.loginTab')}
            </button>
            <button
              type="button"
              className={mode === 'register' ? '' : 'secondary'}
              onClick={() => setMode('register')}
            >
              {t('login.registerTab')}
            </button>
          </div>

          {demoMode ? (
            <p className="status">
              {t('login.demoNotice')}
            </p>
          ) : null}

          {message ? <p className="status">{message}</p> : null}

          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <h2>{t('login.loginHeading')}</h2>
              <input
                type="email"
                placeholder={t('common.email')}
                value={loginForm.email}
                onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                required
              />
              <input
                type="password"
                placeholder={t('common.password')}
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? t('login.signingIn') : t('login.signIn')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <h2>{t('login.registerHeading')}</h2>
              <input
                placeholder={t('common.fullName')}
                value={registerForm.name}
                onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })}
                required
              />
              <input
                type="email"
                placeholder={t('common.email')}
                value={registerForm.email}
                onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                required
              />
              <input
                type="tel"
                placeholder={t('common.phone')}
                value={registerForm.phone}
                onChange={(event) => setRegisterForm({ ...registerForm, phone: event.target.value })}
              />
              <input
                type="password"
                placeholder={t('common.passwordMin')}
                value={registerForm.password}
                onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                required
                minLength={6}
              />
              <select
                value={registerForm.role}
                onChange={(event) => setRegisterForm({ ...registerForm, role: event.target.value })}
              >
                <option value="STUDENT">{t('roles.STUDENT')}</option>
                <option value="SUPERVISOR">{t('roles.SUPERVISOR')}</option>
                <option value="ADMIN">{t('roles.ADMIN')}</option>
              </select>
              <button type="submit" disabled={loading}>
                {loading ? t('login.creating') : t('login.createAccount')}
              </button>
            </form>
          )}
        </section>

        <section className="panel info-panel">
          <h2>{t('login.howItWorks')}</h2>
          <ul className="plain-list">
            <li>{t('login.bullet1')}</li>
            <li>{t('login.bullet2')}</li>
            <li>{t('login.bullet3')}</li>
            <li>{t('login.bullet4')}</li>
          </ul>
        </section>
      </div>
    </Layout>
  );
}
