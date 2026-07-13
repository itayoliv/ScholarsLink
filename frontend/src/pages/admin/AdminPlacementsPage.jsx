import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';

export default function AdminPlacementsPage() {
  const [supervisors, setSupervisors] = useState([]);

  useEffect(() => {
    apiRequest('/users?role=SUPERVISOR')
      .then(setSupervisors)
      .catch(() => setSupervisors([]));
  }, []);

  const supervisorOptions = useMemo(
    () => supervisors.map((user) => ({ value: String(user.id), label: user.name })),
    [supervisors],
  );

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name', filter: { type: 'text' } },
    {
      key: 'description',
      label: 'Description',
      render: (record) => record.description || '—',
    },
    {
      key: 'supervisorId',
      label: 'Supervisor',
      render: (record) => record.supervisor?.name || '—',
      filter: { type: 'select', options: supervisorOptions },
    },
    {
      key: 'students',
      label: 'Active students',
      render: (record) => String(record.memberships?.length ?? 0),
    },
  ], [supervisorOptions]);

  function getFields() {
    return [
      { name: 'name', label: 'Volunteer location', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      {
        name: 'supervisorId',
        label: 'Supervisor',
        type: 'select',
        options: supervisorOptions,
        placeholder: 'Select supervisor',
        required: true,
      },
    ];
  }

  return (
    <AdminEntityPage
      title="Manage placements"
      subtitle="View, filter, add, edit, and remove volunteer placements."
      entity="placements"
      entityLabel="Placement"
      loadRecords={() => apiRequest('/placements')}
      columns={columns}
      getFields={getFields}
      initialValues={(record) => (record
        ? {
            name: record.name,
            description: record.description || '',
            supervisorId: String(record.supervisorId),
          }
        : { name: '', description: '', supervisorId: '' })}
      onCreate={(values) => apiRequest('/placements', {
        method: 'POST',
        body: JSON.stringify(values),
      })}
      onUpdate={(record, values) => apiRequest(`/placements/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      })}
      onDelete={(record) => apiRequest(`/placements/${record.id}`, { method: 'DELETE' })}
    />
  );
}
