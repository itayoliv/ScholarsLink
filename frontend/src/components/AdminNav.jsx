import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const links = [
  { to: '/admin', key: 'overview', end: true },
  { to: '/admin/users', key: 'users' },
  { to: '/admin/form-options', key: 'formOptions' },
  { to: '/admin/placements', key: 'placements' },
  { to: '/admin/join-requests', key: 'joinRequests' },
  { to: '/admin/hour-logs', key: 'hourLogs' },
  { to: '/admin/memberships', key: 'memberships' },
];

export default function AdminNav() {
  const { t } = useTranslation();

  return (
    <nav className="admin-nav" aria-label={t('adminNav.ariaLabel')}>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
        >
          {t(`adminNav.${link.key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
