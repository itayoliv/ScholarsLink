import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';
import StatusBadge from '../../components/StatusBadge';

export default function AdminHourLogsPage() {
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState([]);
  const [placements, setPlacements] = useState([]);

  useEffect(() => {
    Promise.all([apiRequest('/users'), apiRequest('/placements')])
      .then(([nextUsers, nextPlacements]) => {
        setUsers(nextUsers);
        setPlacements(nextPlacements);
      })
      .catch(() => {});
  }, []);

  const statusOptions = useMemo(() => [
    { value: 'PENDING', label: t('status.PENDING') },
    { value: 'APPROVED', label: t('status.APPROVED') },
    { value: 'REJECTED', label: t('status.REJECTED') },
  ], [t]);

  const studentOptions = useMemo(
    () => users
      .filter((user) => user.role === 'STUDENT')
      .map((user) => ({ value: String(user.id), label: user.name })),
    [users],
  );

  const reviewerOptions = useMemo(
    () => users
      .filter((user) => user.role !== 'STUDENT')
      .map((user) => ({
        value: String(user.id),
        label: `${user.name} (${t(`rolesShort.${user.role}`, { defaultValue: user.role })})`,
      })),
    [users, t],
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
      key: 'date',
      label: t('common.date'),
      render: (record) => new Date(record.date).toLocaleDateString(i18n.language),
      filter: {
        type: 'text',
        getValue: (record) => new Date(record.date).toLocaleDateString(i18n.language),
      },
    },
    {
      key: 'hours',
      label: t('common.hours'),
      render: (record) => String(record.hours),
    },
    {
      key: 'description',
      label: t('common.description'),
      render: (record) => record.description || '—',
    },
    {
      key: 'status',
      label: t('common.status'),
      render: (record) => <StatusBadge status={record.status} />,
      filter: { type: 'select', options: statusOptions },
    },
    {
      key: 'reviewedById',
      label: t('admin.reviewedBy'),
      render: (record) => record.reviewedBy?.name || '—',
    },
  ], [t, i18n.language, studentOptions, placementOptions, statusOptions]);

  function getFields(mode) {
    const fields = [
      {
        name: 'studentId',
        label: t('common.student'),
        type: 'select',
        options: studentOptions,
        placeholder: t('admin.hourLogs.selectStudent'),
        required: true,
      },
      {
        name: 'placementId',
        label: t('common.placement'),
        type: 'select',
        options: placementOptions,
        placeholder: t('admin.hourLogs.selectPlacement'),
        required: true,
      },
      { name: 'date', label: t('common.date'), type: 'date', required: true },
      {
        name: 'hours',
        label: t('common.hours'),
        type: 'number',
        min: '0.25',
        step: '0.25',
        required: true,
      },
      { name: 'description', label: t('common.description'), type: 'textarea' },
    ];

    if (mode === 'edit') {
      fields.push(
        { name: 'status', label: t('common.status'), type: 'select', options: statusOptions, required: true },
        {
          name: 'reviewerId',
          label: t('admin.reviewedBy'),
          type: 'select',
          options: reviewerOptions,
          placeholder: t('admin.noReviewer'),
        },
      );
    }

    return fields;
  }

  return (
    <AdminEntityPage
      title={t('admin.hourLogs.title')}
      subtitle={t('admin.hourLogs.subtitle')}
      entity="hour-logs"
      entityLabel={t('admin.entities.hourLog')}
      loadRecords={() => apiRequest('/hour-logs')}
      columns={columns}
      getFields={getFields}
      initialValues={(record) => (record
        ? {
            studentId: String(record.studentId),
            placementId: String(record.placementId),
            date: String(record.date).slice(0, 10),
            hours: String(record.hours),
            description: record.description || '',
            status: record.status,
            reviewerId: record.reviewedById ? String(record.reviewedById) : '',
          }
        : {
            studentId: '',
            placementId: '',
            date: new Date().toISOString().slice(0, 10),
            hours: '',
            description: '',
          })}
      onCreate={(values) => apiRequest('/hour-logs', {
        method: 'POST',
        body: JSON.stringify(values),
      })}
      onUpdate={(record, values) => apiRequest(`/hour-logs/${record.id}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      })}
      onDelete={(record) => apiRequest(`/hour-logs/${record.id}`, { method: 'DELETE' })}
    />
  );
}
