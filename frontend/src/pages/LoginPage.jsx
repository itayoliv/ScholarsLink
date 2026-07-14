import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      title="Welcome to ScholarsLink"
      subtitle="Track scholarship volunteer hours with a simple approval workflow between students, supervisors, and admins."
    >
      <div className="auth-grid">
        <section className="panel">
          <div className="tabs">
            <button
              type="button"
              className={mode === 'login' ? '' : 'secondary'}
              onClick={() => setMode('login')}
            >
              Log in
            </button>
            <button
              type="button"
              className={mode === 'register' ? '' : 'secondary'}
              onClick={() => setMode('register')}
            >
              Create account
            </button>
          </div>

          {demoMode ? (
            <p className="status">
              Demo mode - Try adm@gmail.com / sup@gmail.com / stu1@gmail.com / stu2@gmail.com with
              password 123456
            </p>
          ) : null}

          {message ? <p className="status">{message}</p> : null}

          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <h2>Log in</h2>
              <input
                type="email"
                placeholder="Email"
                value={loginForm.email}
                onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <h2>Create account</h2>
              <input
                placeholder="Full name"
                value={registerForm.name}
                onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={registerForm.email}
                onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                required
              />
              <input
                type="tel"
                placeholder="Phone"
                value={registerForm.phone}
                onChange={(event) => setRegisterForm({ ...registerForm, phone: event.target.value })}
              />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={registerForm.password}
                onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                required
                minLength={6}
              />
              <select
                value={registerForm.role}
                onChange={(event) => setRegisterForm({ ...registerForm, role: event.target.value })}
              >
                <option value="STUDENT">Scholarship student</option>
                <option value="SUPERVISOR">Volunteer supervisor</option>
                <option value="ADMIN">Administrator</option>
              </select>
              <button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create account'}
              </button>
            </form>
          )}
        </section>

        <section className="panel info-panel">
          <h2>How it works</h2>
          <ul className="plain-list">
            <li>Students request a volunteer placement and log hours.</li>
            <li>Supervisors approve join requests and verify submitted hours.</li>
            <li>Admins oversee users, placements, and the full hours picture.</li>
            <li>Students can switch placements during the year when needed.</li>
          </ul>
        </section>
      </div>
    </Layout>
  );
}
