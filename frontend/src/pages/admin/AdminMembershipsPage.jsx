import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';

export default function AdminMembershipsPage() {
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState([]);
  const [placements, setPlacements] = useState([]);

  useEffect(() => {
    Promise.all([apiRequest('/users?role=STUDENT'), apiRequest('/placements')])
      .then(([nextUsers, nextPlacements]) => {
        setUsers(nextUsers);
        setPlacements(nextPlacements);
      })
      .catch(() => {});
  }, []);

  const activeOptions = useMemo(() => [
    { value: 'true', label: t('common.active') },
    { value: 'false', label: t('common.inactive') },
  ], [t]);

  const studentOptions = useMemo(
    () => users.map((user) => ({ value: String(user.id), label: user.name })),
    [users],
  );

  const placementOptions = useMemo(
    () => placements.map((placement) => ({ value: String(placement.id), label: placement.name })),
    [placements],
  );

  const columns = useMemo(() => [
    { key: 'id', label: t('common.id') },
    {
      key: 'studentId',
      label: t('common.student'),
      render: (record) => record.student?.name || '—',
      filter: { type: 'select', options: studentOptions },
    },
    {
      key: 'placementId',
      label: t('common.placement'),
      render: (record) => record.placement?.name || '—',
      filter: { type: 'select', options: placementOptions },
    },
    {
      key: 'active',
      label: t('common.active'),
      render: (record) => (record.active ? t('common.yes') : t('common.no')),
      filter: {
        type: 'select',
        options: activeOptions,
        getValue: (record) => (record.active ? 'true' : 'false'),
      },
    },
    {
      key: 'startedAt',
      label: t('admin.memberships.started'),
      render: (record) => new Date(record.startedAt).toLocaleDateString(i18n.language),
    },
    {
      key: 'endedAt',
      label: t('admin.memberships.ended'),
      render: (record) => (record.endedAt ? new Date(record.endedAt).toLocaleDateString(i18n.language) : '—'),
    },
  ], [t, i18n.language, studentOptions, placementOptions, activeOptions]);

  function getFields() {
    return [
      {
        name: 'studentId',
        label: t('common.student'),
        type: 'select',
        options: studentOptions,
        placeholder: t('admin.memberships.selectStudent'),
        required: true,
      },
      {
        name: 'placementId',
        label: t('common.placement'),
        type: 'select',
        options: placementOptions,
        placeholder: t('admin.memberships.selectPlacement'),
        required: true,
      },
      {
        name: 'active',
        label: t('common.active'),
        type: 'checkbox',
        hint: t('admin.memberships.activeHint'),
      },
      { name: 'startedAt', label: t('admin.memberships.startedAt'), type: 'date' },
      { name: 'endedAt', label: t('admin.memberships.endedAt'), type: 'date' },
    ];
  }

  function buildPayload(values) {
    const payload = {
      ...values,
      studentId: values.studentId,
      placementId: values.placementId,
      active: Boolean(values.active),
      endedAt: values.endedAt || null,
    };

    if (values.startedAt) {
      payload.startedAt = values.startedAt;
    }

    return payload;
  }

  return (
    <AdminEntityPage
      title={t('admin.memberships.title')}
      subtitle={t('admin.memberships.subtitle')}
      entity="memberships"
      entityLabel={t('admin.entities.membership')}
      loadRecords={() => apiRequest('/memberships')}
      columns={columns}
      getFields={getFields}
      initialValues={(record) => (record
        ? {
            studentId: String(record.studentId),
            placementId: String(record.placementId),
            active: record.active,
            startedAt: String(record.startedAt).slice(0, 10),
            endedAt: record.endedAt ? String(record.endedAt).slice(0, 10) : '',
          }
        : { studentId: '', placementId: '', active: true, startedAt: '', endedAt: '' })}
      onCreate={(values) => apiRequest('/memberships', {
        method: 'POST',
        body: JSON.stringify(buildPayload(values)),
      })}
      onUpdate={(record, values) => apiRequest(`/memberships/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify(buildPayload(values)),
      })}
      onDelete={(record) => apiRequest(`/memberships/${record.id}`, { method: 'DELETE' })}
    />
  );
}
