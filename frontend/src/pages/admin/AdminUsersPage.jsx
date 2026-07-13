import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';

const roleOptions = [
  { value: 'STUDENT', label: 'Scholarship student' },
  { value: 'SUPERVISOR', label: 'Volunteer supervisor' },
  { value: 'ADMIN', label: 'Administrator' },
];

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name', filter: { type: 'text' } },
  { key: 'email', label: 'Email', filter: { type: 'text' } },
  {
    key: 'phone',
    label: 'Phone',
    filter: { type: 'text' },
    render: (record) => record.phone || '—',
  },
  { key: 'role', label: 'Role', filter: { type: 'select', options: roleOptions } },
  {
    key: 'createdAt',
    label: 'Created',
    render: (record) => new Date(record.createdAt).toLocaleDateString(),
  },
];

function getFields(mode) {
  return [
    { name: 'name', label: 'Full name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone', type: 'tel' },
    {
      name: 'password',
      label: mode === 'edit' ? 'New password' : 'Password',
      type: 'password',
      required: mode !== 'edit',
      minLength: 6,
      hint: mode === 'edit' ? 'Leave empty to keep the current password.' : 'At least 6 characters.',
    },
    { name: 'role', label: 'Role', type: 'select', options: roleOptions, required: true },
  ];
}

export default function AdminUsersPage() {
  return (
    <AdminEntityPage
      title="Manage users"
      subtitle="View, filter, add, edit, and remove user accounts."
      entity="users"
      entityLabel="User"
      fieldPickerRoles={roleOptions}
      loadRecords={() => apiRequest('/users')}
      columns={columns}
      getFields={getFields}
      initialValues={(record) => (record
        ? {
            name: record.name,
            email: record.email,
            phone: record.phone || '',
            password: '',
            role: record.role,
          }
        : { name: '', email: '', phone: '', password: '', role: 'STUDENT' })}
      onCreate={(values) => apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(values),
      })}
      onUpdate={(record, values) => {
        const payload = { ...values };

        if (!payload.password) {
          delete payload.password;
        }

        return apiRequest(`/users/${record.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }}
      onDelete={(record) => apiRequest(`/users/${record.id}`, { method: 'DELETE' })}
    />
  );
}
