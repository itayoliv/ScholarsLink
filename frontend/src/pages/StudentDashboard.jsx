import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();
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
      setMessage(t('student.joinSent'));
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitHours(event) {
    event.preventDefault();

    if (!summary?.currentPlacement) {
      setMessage(t('student.needPlacement'));
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
      setMessage(t('student.hoursSubmitted'));
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const currentPlacement = summary?.currentPlacement;

  return (
    <Layout
      title={t('student.title', { name: user.name })}
      subtitle={t('student.subtitle')}
    >
      {message ? <p className="status">{message}</p> : null}

      <section className="summary-grid summary-grid-3">
        <article className="summary-card">
          <span>{t('student.currentPlacement')}</span>
          <strong className="summary-text">
            {loading ? '...' : currentPlacement?.name || t('student.noneYet')}
          </strong>
          {currentPlacement ? (
            <small className="muted">
              {t('student.supervisorName', { name: currentPlacement.supervisor?.name })}
            </small>
          ) : null}
        </article>
        <article className="summary-card">
          <span>{t('student.approvedHours')}</span>
          <strong>{loading ? '...' : String(summary?.approvedHours ?? 0)}</strong>
        </article>
        <article className="summary-card">
          <span>{t('student.pendingRequests')}</span>
          <strong>
            {loading ? '...' : String(joinRequests.filter((item) => item.status === 'PENDING').length)}
          </strong>
        </article>
      </section>

      <section className="panel-grid panel-grid-2">
        <form className="panel" onSubmit={submitJoin}>
          <h2>{currentPlacement ? t('student.changePlacement') : t('student.requestPlacement')}</h2>
          <p className="muted">
            {t('student.joinHelp')}
          </p>
          <select
            value={joinForm.placementId}
            onChange={(event) => setJoinForm({ ...joinForm, placementId: event.target.value })}
            required
          >
            <option value="">{t('student.selectPlacement')}</option>
            {placements.map((placement) => (
              <option value={placement.id} key={placement.id}>
                {placement.name} — {placement.supervisor?.name}
              </option>
            ))}
          </select>
          <textarea
            placeholder={t('student.optionalNote')}
            value={joinForm.note}
            onChange={(event) => setJoinForm({ ...joinForm, note: event.target.value })}
          />
          <button type="submit">{t('student.sendJoinRequest')}</button>
        </form>

        <form className="panel" onSubmit={submitHours}>
          <h2>{t('student.logHours')}</h2>
          <p className="muted">
            {currentPlacement
              ? t('student.loggingAgainst', { name: currentPlacement.name })
              : t('student.availableAfter')}
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
            placeholder={t('common.hours')}
            value={hourForm.hours}
            onChange={(event) => setHourForm({ ...hourForm, hours: event.target.value })}
            required
            disabled={!currentPlacement}
          />
          <textarea
            placeholder={t('student.whatDidYouDo')}
            value={hourForm.description}
            onChange={(event) => setHourForm({ ...hourForm, description: event.target.value })}
            disabled={!currentPlacement}
          />
          <button type="submit" disabled={!currentPlacement}>
            {t('student.submitHours')}
          </button>
        </form>
      </section>

      <section className="review-grid">
        <section className="panel">
          <h2>{t('student.myJoinRequests')}</h2>
          <div className="list">
            {joinRequests.length === 0 ? <p className="muted">{t('student.noJoinRequests')}</p> : null}
            {joinRequests.map((item) => (
              <article className="list-item" key={item.id}>
                <div>
                  <strong>{item.placement.name}</strong>
                  <span>{t('student.supervisorName', { name: item.placement.supervisor?.name })}</span>
                  {item.note ? <span>{item.note}</span> : null}
                </div>
                <StatusBadge status={item.status} />
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>{t('student.myHours')}</h2>
          <div className="table-wrap">
            {hourLogs.length === 0 ? <p className="muted">{t('student.noHourLogs')}</p> : (
              <table>
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('common.placement')}</th>
                    <th>{t('common.hours')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {hourLogs.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.date).toLocaleDateString(i18n.language)}</td>
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
