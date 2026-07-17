import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth';
import LanguageSwitcher from './LanguageSwitcher';

export default function Layout({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <Link to="/" className="brand">
            ScholarsLink
          </Link>
          <p className="muted topbar-meta">
            {user
              ? `${user.name} · ${t(`rolesShort.${user.role}`, { defaultValue: user.role })}`
              : t('layout.tagline')}
          </p>
        </div>
        <div className="topbar-actions">
          <LanguageSwitcher />
          {user ? (
            <button type="button" className="secondary" onClick={logout}>
              {t('layout.logout')}
            </button>
          ) : null}
        </div>
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
