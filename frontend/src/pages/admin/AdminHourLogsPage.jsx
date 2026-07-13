import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';
import StatusBadge from '../../components/StatusBadge';

const statusOptions = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function AdminHourLogsPage() {
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

  const studentOptions = useMemo(
    () => users
      .filter((user) => user.role === 'STUDENT')
      .map((user) => ({ value: String(user.id), label: user.name })),
    [users],
  );

  const reviewerOptions = useMemo(
    () => users
      .filter((user) => user.role !== 'STUDENT')
      .map((user) => ({ value: String(user.id), label: `${user.name} (${user.role})` })),
    [users],
  );

  const placementOptions = useMemo(
    () => placements.map((placement) => ({ value: String(placement.id), label: placement.name })),
    [placements],
  );

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    {
      key: 'studentId',
      label: 'Student',
      render: (record) => record.student?.name || '—',
      filter: { type: 'select', options: studentOptions },
    },
    {
      key: 'placementId',
      label: 'Placement',
      render: (record) => record.placement?.name || '—',
      filter: { type: 'select', options: placementOptions },
    },
    {
      key: 'date',
      label: 'Date',
      render: (record) => new Date(record.date).toLocaleDateString(),
      filter: {
        type: 'text',
        getValue: (record) => new Date(record.date).toLocaleDateString(),
      },
    },
    {
      key: 'hours',
      label: 'Hours',
      render: (record) => String(record.hours),
    },
    {
      key: 'description',
      label: 'Description',
      render: (record) => record.description || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (record) => <StatusBadge status={record.status} />,
      filter: { type: 'select', options: statusOptions },
    },
    {
      key: 'reviewedById',
      label: 'Reviewed by',
      render: (record) => record.reviewedBy?.name || '—',
    },
  ], [studentOptions, placementOptions]);

  function getFields(mode) {
    const fields = [
      {
        name: 'studentId',
        label: 'Student',
        type: 'select',
        options: studentOptions,
        placeholder: 'Select student',
        required: true,
      },
      {
        name: 'placementId',
        label: 'Placement',
        type: 'select',
        options: placementOptions,
        placeholder: 'Select placement',
        required: true,
      },
      { name: 'date', label: 'Date', type: 'date', required: true },
      {
        name: 'hours',
        label: 'Hours',
        type: 'number',
        min: '0.25',
        step: '0.25',
        required: true,
      },
      { name: 'description', label: 'Description', type: 'textarea' },
    ];

    if (mode === 'edit') {
      fields.push(
        { name: 'status', label: 'Status', type: 'select', options: statusOptions, required: true },
        {
          name: 'reviewerId',
          label: 'Reviewed by',
          type: 'select',
          options: reviewerOptions,
          placeholder: 'No reviewer',
        },
      );
    }

    return fields;
  }

  return (
    <AdminEntityPage
      title="Manage hour logs"
      subtitle="View, filter, add, edit, and remove volunteer hour logs."
      entity="hour-logs"
      entityLabel="Hour log"
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
