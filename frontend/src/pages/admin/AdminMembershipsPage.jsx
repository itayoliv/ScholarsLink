import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';

const activeOptions = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

export default function AdminMembershipsPage() {
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

  const studentOptions = useMemo(
    () => users.map((user) => ({ value: String(user.id), label: user.name })),
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
      key: 'active',
      label: 'Active',
      render: (record) => (record.active ? 'Yes' : 'No'),
      filter: {
        type: 'select',
        options: activeOptions,
        getValue: (record) => (record.active ? 'true' : 'false'),
      },
    },
    {
      key: 'startedAt',
      label: 'Started',
      render: (record) => new Date(record.startedAt).toLocaleDateString(),
    },
    {
      key: 'endedAt',
      label: 'Ended',
      render: (record) => (record.endedAt ? new Date(record.endedAt).toLocaleDateString() : '—'),
    },
  ], [studentOptions, placementOptions]);

  function getFields() {
    return [
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
      {
        name: 'active',
        label: 'Active',
        type: 'checkbox',
        hint: 'Activating deactivates the student\'s other active membership.',
      },
      { name: 'startedAt', label: 'Started at', type: 'date' },
      { name: 'endedAt', label: 'Ended at', type: 'date' },
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
      title="Manage memberships"
      subtitle="View, filter, add, edit, and remove placement memberships."
      entity="memberships"
      entityLabel="Membership"
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
