import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';

export default function AdminPlacementsPage() {
  const { t } = useTranslation();
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
    { key: 'id', label: t('common.id') },
    { key: 'name', label: t('common.name'), filter: { type: 'text' } },
    {
      key: 'description',
      label: t('common.description'),
      render: (record) => record.description || '—',
    },
    {
      key: 'supervisorId',
      label: t('common.supervisor'),
      render: (record) => record.supervisor?.name || '—',
      filter: { type: 'select', options: supervisorOptions },
    },
    {
      key: 'students',
      label: t('admin.placements.activeStudents'),
      render: (record) => String(record.memberships?.length ?? 0),
    },
  ], [t, supervisorOptions]);

  function getFields() {
    return [
      { name: 'name', label: t('admin.placements.volunteerLocation'), type: 'text', required: true },
      { name: 'description', label: t('common.description'), type: 'textarea' },
      {
        name: 'supervisorId',
        label: t('common.supervisor'),
        type: 'select',
        options: supervisorOptions,
        placeholder: t('admin.placements.selectSupervisor'),
        required: true,
      },
    ];
  }

  return (
    <AdminEntityPage
      title={t('admin.placements.title')}
      subtitle={t('admin.placements.subtitle')}
      entity="placements"
      entityLabel={t('admin.entities.placement')}
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
