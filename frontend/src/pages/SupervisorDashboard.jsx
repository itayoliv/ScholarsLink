import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
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
      setMessage(t('supervisor.markedAs', { status: t(`status.${status}`) }));
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
      title={t('supervisor.title', { name: user.name })}
      subtitle={t('supervisor.subtitle')}
    >
      {message ? <p className="status">{message}</p> : null}

      <section className="summary-grid summary-grid-3">
        <article className="summary-card">
          <span>{t('supervisor.myPlacements')}</span>
          <strong>{loading ? '...' : String(placements.length)}</strong>
        </article>
        <article className="summary-card">
          <span>{t('supervisor.pendingJoins')}</span>
          <strong>{loading ? '...' : String(pendingJoins.length)}</strong>
        </article>
        <article className="summary-card">
          <span>{t('supervisor.pendingHours')}</span>
          <strong>{loading ? '...' : String(pendingHours.length)}</strong>
        </article>
      </section>

      <section className="review-grid">
        <section className="panel">
          <h2>{t('supervisor.joinApprovals')}</h2>
          <div className="list">
            {pendingJoins.length === 0 ? <p className="muted">{t('supervisor.noPendingJoins')}</p> : null}
            {pendingJoins.map((item) => (
              <article className="list-item" key={item.id}>
                <div>
                  <strong>
                    {t('supervisor.wantsToJoin', {
                      student: item.student.name,
                      placement: item.placement.name,
                    })}
                  </strong>
                  <span>{item.note || t('supervisor.noNote')}</span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="actions">
                  <button type="button" onClick={() => review(`/join-requests/${item.id}`, 'APPROVED')}>
                    {t('supervisor.approve')}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => review(`/join-requests/${item.id}`, 'REJECTED')}
                  >
                    {t('supervisor.reject')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>{t('supervisor.hoursApprovals')}</h2>
          <div className="list">
            {pendingHours.length === 0 ? <p className="muted">{t('supervisor.noPendingHours')}</p> : null}
            {pendingHours.map((item) => (
              <article className="list-item" key={item.id}>
                <div>
                  <strong>
                    {t('supervisor.loggedHours', {
                      student: item.student.name,
                      hours: String(item.hours),
                      placement: item.placement.name,
                    })}
                  </strong>
                  <span>
                    {new Date(item.date).toLocaleDateString(i18n.language)} — {item.description || t('supervisor.noDetails')}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="actions">
                  <button type="button" onClick={() => review(`/hour-logs/${item.id}`, 'APPROVED')}>
                    {t('supervisor.approve')}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => review(`/hour-logs/${item.id}`, 'REJECTED')}
                  >
                    {t('supervisor.reject')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>{t('supervisor.myStudents')}</h2>
        <div className="table-wrap">
          {students.length === 0 ? <p className="muted">{t('supervisor.noActiveStudents')}</p> : (
            <table>
              <thead>
                <tr>
                  <th>{t('common.student')}</th>
                  <th>{t('common.email')}</th>
                  <th>{t('common.placement')}</th>
                  <th>{t('supervisor.approvedHours')}</th>
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
