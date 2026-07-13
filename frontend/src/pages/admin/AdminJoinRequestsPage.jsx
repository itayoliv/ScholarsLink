import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';
import StatusBadge from '../../components/StatusBadge';

const statusOptions = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function AdminJoinRequestsPage() {
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
      key: 'status',
      label: 'Status',
      render: (record) => <StatusBadge status={record.status} />,
      filter: { type: 'select', options: statusOptions },
    },
    {
      key: 'note',
      label: 'Note',
      render: (record) => record.note || '—',
    },
    {
      key: 'reviewedById',
      label: 'Reviewed by',
      render: (record) => record.reviewedBy?.name || '—',
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (record) => new Date(record.createdAt).toLocaleDateString(),
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
      { name: 'note', label: 'Note', type: 'textarea' },
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
          hint: 'Setting status to approved activates the placement for the student.',
        },
      );
    }

    return fields;
  }

  return (
    <AdminEntityPage
      title="Manage join requests"
      subtitle="View, filter, add, edit, and remove placement join requests."
      entity="join-requests"
      entityLabel="Join request"
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
