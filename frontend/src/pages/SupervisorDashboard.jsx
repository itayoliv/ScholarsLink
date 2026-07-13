import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const [placements, setPlacements] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [hourLogs, setHourLogs] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    try {
      const [nextPlacements, nextJoinRequests, nextHourLogs] = await Promise.all([
        apiRequest(`/placements?supervisorId=${user.id}`),
        apiRequest(`/join-requests?supervisorId=${user.id}`),
        apiRequest(`/hour-logs?supervisorId=${user.id}`),
      ]);

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
  }, [user.id]);

  async function review(path, status) {
    try {
      await apiRequest(path, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewerId: user.id }),
      });
      setMessage(`Marked as ${status.toLowerCase()}.`);
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const pendingJoins = joinRequests.filter((item) => item.status === 'PENDING');
  const pendingHours = hourLogs.filter((item) => item.status === 'PENDING');

  const students = useMemo(() => {
    const map = new Map();

    for (const placement of placements) {
      for (const membership of placement.memberships || []) {
        const student = membership.student;
        if (!student) {
          continue;
        }

        const approvedHours = hourLogs
          .filter((log) => log.studentId === student.id && log.status === 'APPROVED')
          .reduce((sum, log) => sum + Number(log.hours), 0);

        map.set(student.id, {
          id: student.id,
          name: student.name,
          email: student.email,
          placementName: placement.name,
          approvedHours,
        });
      }
    }

    return Array.from(map.values());
  }, [placements, hourLogs]);

  return (
    <Layout
      title={`Supervisor desk — ${user.name}`}
      subtitle="Approve join requests and verify volunteer hours whenever you are ready."
    >
      {message ? <p className="status">{message}</p> : null}

      <section className="summary-grid summary-grid-3">
        <article className="summary-card">
          <span>My placements</span>
          <strong>{loading ? '...' : String(placements.length)}</strong>
        </article>
        <article className="summary-card">
          <span>Pending joins</span>
          <strong>{loading ? '...' : String(pendingJoins.length)}</strong>
        </article>
        <article className="summary-card">
          <span>Pending hours</span>
          <strong>{loading ? '...' : String(pendingHours.length)}</strong>
        </article>
      </section>

      <section className="review-grid">
        <section className="panel">
          <h2>Join approvals</h2>
          <div className="list">
            {pendingJoins.length === 0 ? <p className="muted">No pending join requests.</p> : null}
            {pendingJoins.map((item) => (
              <article className="list-item" key={item.id}>
                <div>
                  <strong>{item.student.name} wants to join {item.placement.name}</strong>
                  <span>{item.note || 'No note provided.'}</span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="actions">
                  <button type="button" onClick={() => review(`/join-requests/${item.id}`, 'APPROVED')}>
                    Approve
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => review(`/join-requests/${item.id}`, 'REJECTED')}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Hours approvals</h2>
          <div className="list">
            {pendingHours.length === 0 ? <p className="muted">No pending hour logs.</p> : null}
            {pendingHours.map((item) => (
              <article className="list-item" key={item.id}>
                <div>
                  <strong>
                    {item.student.name} logged {String(item.hours)} hours at {item.placement.name}
                  </strong>
                  <span>
                    {new Date(item.date).toLocaleDateString()} — {item.description || 'No details'}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="actions">
                  <button type="button" onClick={() => review(`/hour-logs/${item.id}`, 'APPROVED')}>
                    Approve
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => review(`/hour-logs/${item.id}`, 'REJECTED')}
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>My students</h2>
        <div className="table-wrap">
          {students.length === 0 ? <p className="muted">No active students yet.</p> : (
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Placement</th>
                  <th>Approved hours</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.placementName}</td>
                    <td>{student.approvedHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </Layout>
  );
}
