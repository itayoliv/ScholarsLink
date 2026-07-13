import { Link } from 'react-router-dom';
import { useAuth } from '../auth';

const roleLabels = {
  STUDENT: 'Student',
  SUPERVISOR: 'Supervisor',
  ADMIN: 'Administrator',
};

export default function Layout({ children, title, subtitle }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <Link to="/" className="brand">
            ScholarsLink
          </Link>
          <p className="muted topbar-meta">
            {user ? `${user.name} · ${roleLabels[user.role] || user.role}` : 'Volunteer hours tracking'}
          </p>
        </div>
        {user ? (
          <button type="button" className="secondary" onClick={logout}>
            Log out
          </button>
        ) : null}
      </header>

      {(title || subtitle) ? (
        <section className="page-hero">
          {title ? <h1>{title}</h1> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </section>
      ) : null}

      {children}
    </div>
  );
}
