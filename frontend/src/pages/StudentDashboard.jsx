import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';

const emptyJoin = { placementId: '', note: '' };
const emptyHours = {
  date: new Date().toISOString().slice(0, 10),
  hours: '',
  description: '',
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [hourLogs, setHourLogs] = useState([]);
  const [joinForm, setJoinForm] = useState(emptyJoin);
  const [hourForm, setHourForm] = useState(emptyHours);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    try {
      const [nextSummary, nextPlacements, nextJoinRequests, nextHourLogs] = await Promise.all([
        apiRequest(`/students/${user.id}/summary`),
        apiRequest('/placements'),
        apiRequest(`/join-requests?studentId=${user.id}`),
        apiRequest(`/hour-logs?studentId=${user.id}`),
      ]);

      setSummary(nextSummary);
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
    if (!user.formsCompleted) {
      return;
    }

    loadData();
  }, [user.id, user.formsCompleted]);

  if (!user.formsCompleted) {
    return <Navigate to="/student/registration" replace />;
  }

  async function submitJoin(event) {
    event.preventDefault();

    try {
      await apiRequest('/join-requests', {
        method: 'POST',
        body: JSON.stringify({
          studentId: user.id,
          placementId: joinForm.placementId,
          note: joinForm.note,
        }),
      });
      setJoinForm(emptyJoin);
      setMessage('Join request sent to the supervisor.');
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitHours(event) {
    event.preventDefault();

    if (!summary?.currentPlacement) {
      setMessage('You need an approved placement before logging hours.');
      return;
    }

    try {
      await apiRequest('/hour-logs', {
        method: 'POST',
        body: JSON.stringify({
          studentId: user.id,
          placementId: summary.currentPlacement.id,
          date: hourForm.date,
          hours: hourForm.hours,
          description: hourForm.description,
        }),
      });
      setHourForm(emptyHours);
      setMessage('Hours submitted for approval.');
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const currentPlacement = summary?.currentPlacement;

  return (
    <Layout
      title={`Hi, ${user.name}`}
      subtitle="Request or change your volunteer placement, then log hours for supervisor approval."
    >
      {message ? <p className="status">{message}</p> : null}

      <section className="summary-grid summary-grid-3">
        <article className="summary-card">
          <span>Current placement</span>
          <strong className="summary-text">
            {loading ? '...' : currentPlacement?.name || 'None yet'}
          </strong>
          {currentPlacement ? (
            <small className="muted">Supervisor: {currentPlacement.supervisor?.name}</small>
          ) : null}
        </article>
        <article className="summary-card">
          <span>Approved hours</span>
          <strong>{loading ? '...' : String(summary?.approvedHours ?? 0)}</strong>
        </article>
        <article className="summary-card">
          <span>Pending requests</span>
          <strong>
            {loading ? '...' : String(joinRequests.filter((item) => item.status === 'PENDING').length)}
          </strong>
        </article>
      </section>

      <section className="panel-grid panel-grid-2">
        <form className="panel" onSubmit={submitJoin}>
          <h2>{currentPlacement ? 'Change placement' : 'Request a placement'}</h2>
          <p className="muted">
            Selecting a new location sends a join request to that site&apos;s supervisor.
          </p>
          <select
            value={joinForm.placementId}
            onChange={(event) => setJoinForm({ ...joinForm, placementId: event.target.value })}
            required
          >
            <option value="">Select placement</option>
            {placements.map((placement) => (
              <option value={placement.id} key={placement.id}>
                {placement.name} — {placement.supervisor?.name}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Optional note to supervisor"
            value={joinForm.note}
            onChange={(event) => setJoinForm({ ...joinForm, note: event.target.value })}
          />
          <button type="submit">Send join request</button>
        </form>

        <form className="panel" onSubmit={submitHours}>
          <h2>Log volunteer hours</h2>
          <p className="muted">
            {currentPlacement
              ? `Logging against ${currentPlacement.name}.`
              : 'Available after your placement is approved.'}
          </p>
          <input
            type="date"
            value={hourForm.date}
            onChange={(event) => setHourForm({ ...hourForm, date: event.target.value })}
            required
            disabled={!currentPlacement}
          />
          <input
            type="number"
            min="0.25"
            step="0.25"
            placeholder="Hours"
            value={hourForm.hours}
            onChange={(event) => setHourForm({ ...hourForm, hours: event.target.value })}
            required
            disabled={!currentPlacement}
          />
          <textarea
            placeholder="What did you do?"
            value={hourForm.description}
            onChange={(event) => setHourForm({ ...hourForm, description: event.target.value })}
            disabled={!currentPlacement}
          />
          <button type="submit" disabled={!currentPlacement}>
            Submit hours
          </button>
        </form>
      </section>

      <section className="review-grid">
        <section className="panel">
          <h2>My join requests</h2>
          <div className="list">
            {joinRequests.length === 0 ? <p className="muted">No join requests yet.</p> : null}
            {joinRequests.map((item) => (
              <article className="list-item" key={item.id}>
                <div>
                  <strong>{item.placement.name}</strong>
                  <span>Supervisor: {item.placement.supervisor?.name}</span>
                  {item.note ? <span>{item.note}</span> : null}
                </div>
                <StatusBadge status={item.status} />
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>My hours</h2>
          <div className="table-wrap">
            {hourLogs.length === 0 ? <p className="muted">No hour logs yet.</p> : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Placement</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hourLogs.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.date).toLocaleDateString()}</td>
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
