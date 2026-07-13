import { NavLink } from 'react-router-dom';

const links = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/form-options', label: 'Form Options' },
  { to: '/admin/placements', label: 'Placements' },
  { to: '/admin/join-requests', label: 'Join Requests' },
  { to: '/admin/hour-logs', label: 'Hour Logs' },
  { to: '/admin/memberships', label: 'Memberships' },
];

export default function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Admin sections">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
