import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';
import StatusBadge from '../../components/StatusBadge';

export default function AdminJoinRequestsPage() {
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
      key: 'status',
      label: t('common.status'),
      render: (record) => <StatusBadge status={record.status} />,
      filter: { type: 'select', options: statusOptions },
    },
    {
      key: 'note',
      label: t('common.note'),
      render: (record) => record.note || '—',
    },
    {
      key: 'reviewedById',
      label: t('admin.reviewedBy'),
      render: (record) => record.reviewedBy?.name || '—',
    },
    {
      key: 'createdAt',
      label: t('common.created'),
      render: (record) => new Date(record.createdAt).toLocaleDateString(i18n.language),
    },
  ], [t, i18n.language, studentOptions, placementOptions, statusOptions]);

  function getFields(mode) {
    const fields = [
      {
        name: 'studentId',
        label: t('common.student'),
        type: 'select',
        options: studentOptions,
        placeholder: t('admin.joinRequests.selectStudent'),
        required: true,
      },
      {
        name: 'placementId',
        label: t('common.placement'),
        type: 'select',
        options: placementOptions,
        placeholder: t('admin.joinRequests.selectPlacement'),
        required: true,
      },
      { name: 'note', label: t('common.note'), type: 'textarea' },
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
          hint: t('admin.joinRequests.statusHint'),
        },
      );
    }

    return fields;
  }

  return (
    <AdminEntityPage
      title={t('admin.joinRequests.title')}
      subtitle={t('admin.joinRequests.subtitle')}
      entity="join-requests"
      entityLabel={t('admin.entities.joinRequest')}
      loadRecords={() => apiRequest('/join-requests')}
      columns={columns}
      getFields={getFields}
      initialValues={(record) => (record
        ? {
            studentId: String(record.studentId),
            placementId: String(record.placementId),
            note: record.note || '',
            status: record.status,
            reviewerId: record.reviewedById ? String(record.reviewedById) : '',
          }
        : { studentId: '', placementId: '', note: '' })}
      onCreate={(values) => apiRequest('/join-requests', {
        method: 'POST',
        body: JSON.stringify(values),
      })}
      onUpdate={(record, values) => apiRequest(`/join-requests/${record.id}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      })}
      onDelete={(record) => apiRequest(`/join-requests/${record.id}`, { method: 'DELETE' })}
    />
  );
}
