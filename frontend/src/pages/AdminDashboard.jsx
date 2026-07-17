import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../api';
import AdminNav from '../components/AdminNav';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';

const emptyUser = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'SUPERVISOR',
};

const emptyPlacement = {
  name: '',
  description: '',
  supervisorId: '',
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [hourLogs, setHourLogs] = useState([]);
  const [userForm, setUserForm] = useState(emptyUser);
  const [placementForm, setPlacementForm] = useState(emptyPlacement);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const supervisors = users.filter((user) => user.role === 'SUPERVISOR');

  async function loadData() {
    setLoading(true);

    try {
      const [nextSummary, nextUsers, nextPlacements, nextJoinRequests, nextHourLogs] = await Promise.all([
        apiRequest('/admin/summary'),
        apiRequest('/users'),
        apiRequest('/placements'),
        apiRequest('/join-requests'),
        apiRequest('/hour-logs'),
      ]);

      setSummary(nextSummary);
      setUsers(nextUsers);
      setPlacements(nextPlacements);
      setJoinRequests(nextJoinRequests);
      setHourLogs(nextHourLogs);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createUser(event) {
    event.preventDefault();

    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(userForm),
      });
      setUserForm(emptyUser);
      setMessage(t('adminDash.accountCreated'));
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createPlacement(event) {
    event.preventDefault();

    try {
      await apiRequest('/placements', {
        method: 'POST',
        body: JSON.stringify(placementForm),
      });
      setPlacementForm(emptyPlacement);
      setMessage(t('adminDash.placementCreated'));
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <Layout
      title={t('adminDash.title')}
      subtitle={t('adminDash.subtitle')}
    >
      <AdminNav />

      {message ? <p className="status">{message}</p> : null}

      <section className="summary-grid">
        {[
          [t('adminDash.students'), summary?.students ?? 0],
          [t('adminDash.supervisors'), summary?.supervisors ?? 0],
          [t('adminDash.placements'), summary?.placements ?? 0],
          [t('adminDash.pendingJoins'), summary?.pendingJoinRequests ?? 0],
          [t('adminDash.pendingHours'), summary?.pendingHourLogs ?? 0],
          [t('adminDash.approvedHours'), summary?.approvedHours ?? 0],
        ].map(([label, value]) => (
          <article className="summary-card" key={label}>
            <span>{label}</span>
            <strong>{loading ? '...' : String(value)}</strong>
          </article>
        ))}
      </section>

      <section className="panel-grid panel-grid-2">
        <form className="panel" onSubmit={createUser}>
          <h2>{t('adminDash.createAccount')}</h2>
          <input
            placeholder={t('common.fullName')}
            value={userForm.name}
            onChange={(event) => setUserForm({ ...userForm, name: event.target.value })}
            required
          />
          <input
            type="email"
            placeholder={t('common.email')}
            value={userForm.email}
            onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
            required
          />
          <input
            type="tel"
            placeholder={t('common.phone')}
            value={userForm.phone}
            onChange={(event) => setUserForm({ ...userForm, phone: event.target.value })}
          />
          <input
            type="password"
            placeholder={t('common.passwordMin')}
            value={userForm.password}
            onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
            required
            minLength={6}
          />
          <select
            value={userForm.role}
            onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
          >
            <option value="STUDENT">{t('roles.STUDENT')}</option>
            <option value="SUPERVISOR">{t('roles.SUPERVISOR')}</option>
            <option value="ADMIN">{t('roles.ADMIN')}</option>
          </select>
          <button type="submit">{t('adminDash.createAccount')}</button>
        </form>

        <form className="panel" onSubmit={createPlacement}>
          <h2>{t('adminDash.createPlacement')}</h2>
          <input
            placeholder={t('adminDash.volunteerLocation')}
            value={placementForm.name}
            onChange={(event) => setPlacementForm({ ...placementForm, name: event.target.value })}
            required
          />
          <textarea
            placeholder={t('adminDash.shortDescription')}
            value={placementForm.description}
            onChange={(event) => setPlacementForm({ ...placementForm, description: event.target.value })}
          />
          <select
            value={placementForm.supervisorId}
            onChange={(event) => setPlacementForm({ ...placementForm, supervisorId: event.target.value })}
            required
          >
            <option value="">{t('adminDash.selectSupervisor')}</option>
            {supervisors.map((supervisor) => (
              <option value={supervisor.id} key={supervisor.id}>
                {supervisor.name}
              </option>
            ))}
          </select>
          <button type="submit">{t('adminDash.createPlacement')}</button>
        </form>
      </section>

      <section className="review-grid" style={{ marginTop: 16 }}>
        <section className="panel">
          <h2>{t('adminDash.users')}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('common.email')}</th>
                  <th>{t('common.role')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>{t(`rolesShort.${item.role}`, { defaultValue: item.role })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>{t('adminDash.placements')}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('common.supervisor')}</th>
                  <th>{t('adminDash.activeStudents')}</th>
                </tr>
              </thead>
              <tbody>
                {placements.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.supervisor?.name}</td>
                    <td>{item.memberships?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="review-grid" style={{ marginTop: 16 }}>
        <section className="panel">
          <h2>{t('adminDash.joinRequests')}</h2>
          <div className="list">
            {joinRequests.length === 0 ? <p className="muted">{t('adminDash.noJoinRequests')}</p> : null}
            {joinRequests.map((item) => (
              <article className="list-item" key={item.id}>
                <div>
                  <strong>{item.student.name} → {item.placement.name}</strong>
                  <span>{t('adminDash.supervisorName', { name: item.placement.supervisor?.name })}</span>
                </div>
                <StatusBadge status={item.status} />
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>{t('adminDash.hourLogs')}</h2>
          <div className="table-wrap">
            {hourLogs.length === 0 ? <p className="muted">{t('adminDash.noHourLogs')}</p> : (
              <table>
                <thead>
                  <tr>
                    <th>{t('common.student')}</th>
                    <th>{t('common.placement')}</th>
                    <th>{t('common.hours')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {hourLogs.map((item) => (
                    <tr key={item.id}>
                      <td>{item.student.name}</td>
                      <td>{item.placement.name}</td>
                      <td>{String(item.hours)}</td>
                      <td><StatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </section>
    </Layout>
  );
}
