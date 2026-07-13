import { useEffect, useState } from 'react';
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
      setMessage('Account created.');
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
      setMessage('Placement created.');
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <Layout
      title="Admin overview"
      subtitle="Monitor users, placements, join requests, and volunteer hours across the system."
    >
      <AdminNav />

      {message ? <p className="status">{message}</p> : null}

      <section className="summary-grid">
        {[
          ['Students', summary?.students ?? 0],
          ['Supervisors', summary?.supervisors ?? 0],
          ['Placements', summary?.placements ?? 0],
          ['Pending joins', summary?.pendingJoinRequests ?? 0],
          ['Pending hours', summary?.pendingHourLogs ?? 0],
          ['Approved hours', summary?.approvedHours ?? 0],
        ].map(([label, value]) => (
          <article className="summary-card" key={label}>
            <span>{label}</span>
            <strong>{loading ? '...' : String(value)}</strong>
          </article>
        ))}
      </section>

      <section className="panel-grid panel-grid-2">
        <form className="panel" onSubmit={createUser}>
          <h2>Create account</h2>
          <input
            placeholder="Full name"
            value={userForm.name}
            onChange={(event) => setUserForm({ ...userForm, name: event.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={userForm.email}
            onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
            required
          />
          <input
            type="tel"
            placeholder="Phone"
            value={userForm.phone}
            onChange={(event) => setUserForm({ ...userForm, phone: event.target.value })}
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={userForm.password}
            onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
            required
            minLength={6}
          />
          <select
            value={userForm.role}
            onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
          >
            <option value="STUDENT">Scholarship student</option>
            <option value="SUPERVISOR">Volunteer supervisor</option>
            <option value="ADMIN">Administrator</option>
          </select>
          <button type="submit">Create account</button>
        </form>

        <form className="panel" onSubmit={createPlacement}>
          <h2>Create placement</h2>
          <input
            placeholder="Volunteer location"
            value={placementForm.name}
            onChange={(event) => setPlacementForm({ ...placementForm, name: event.target.value })}
            required
          />
          <textarea
            placeholder="Short description"
            value={placementForm.description}
            onChange={(event) => setPlacementForm({ ...placementForm, description: event.target.value })}
          />
          <select
            value={placementForm.supervisorId}
            onChange={(event) => setPlacementForm({ ...placementForm, supervisorId: event.target.value })}
            required
          >
            <option value="">Select supervisor</option>
            {supervisors.map((supervisor) => (
              <option value={supervisor.id} key={supervisor.id}>
                {supervisor.name}
              </option>
            ))}
          </select>
          <button type="submit">Create placement</button>
        </form>
      </section>

      <section className="review-grid" style={{ marginTop: 16 }}>
        <section className="panel">
          <h2>Users</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>{item.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Placements</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Supervisor</th>
                  <th>Active students</th>
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
          <h2>Join requests</h2>
          <div className="list">
            {joinRequests.length === 0 ? <p className="muted">No join requests.</p> : null}
            {joinRequests.map((item) => (
              <article className="list-item" key={item.id}>
                <div>
                  <strong>{item.student.name} → {item.placement.name}</strong>
                  <span>Supervisor: {item.placement.supervisor?.name}</span>
                </div>
                <StatusBadge status={item.status} />
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Hour logs</h2>
          <div className="table-wrap">
            {hourLogs.length === 0 ? <p className="muted">No hour logs.</p> : (
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Placement</th>
                    <th>Hours</th>
                    <th>Status</th>
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
