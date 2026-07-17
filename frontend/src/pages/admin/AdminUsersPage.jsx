import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';

export default function AdminUsersPage() {
  const { t, i18n } = useTranslation();

  const roleOptions = useMemo(() => [
    { value: 'STUDENT', label: t('roles.STUDENT') },
    { value: 'SUPERVISOR', label: t('roles.SUPERVISOR') },
    { value: 'ADMIN', label: t('roles.ADMIN') },
  ], [t]);

  const columns = useMemo(() => [
    { key: 'id', label: t('common.id') },
    { key: 'name', label: t('common.name'), filter: { type: 'text' } },
    { key: 'email', label: t('common.email'), filter: { type: 'text' } },
    {
      key: 'phone',
      label: t('common.phone'),
      filter: { type: 'text' },
      render: (record) => record.phone || '—',
    },
    {
      key: 'role',
      label: t('common.role'),
      filter: { type: 'select', options: roleOptions },
      render: (record) => t(`roles.${record.role}`, { defaultValue: record.role }),
    },
    {
      key: 'createdAt',
      label: t('common.created'),
      render: (record) => new Date(record.createdAt).toLocaleDateString(i18n.language),
    },
  ], [t, i18n.language, roleOptions]);

  function getFields(mode) {
    return [
      { name: 'name', label: t('common.fullName'), type: 'text', required: true },
      { name: 'email', label: t('common.email'), type: 'email', required: true },
      { name: 'phone', label: t('common.phone'), type: 'tel' },
      {
        name: 'password',
        label: mode === 'edit' ? t('admin.users.newPassword') : t('common.password'),
        type: 'password',
        required: mode !== 'edit',
        minLength: 6,
        hint: mode === 'edit' ? t('admin.users.passwordEditHint') : t('admin.users.passwordCreateHint'),
      },
      { name: 'role', label: t('common.role'), type: 'select', options: roleOptions, required: true },
    ];
  }

  return (
    <AdminEntityPage
      title={t('admin.users.title')}
      subtitle={t('admin.users.subtitle')}
      entity="users"
      entityLabel={t('admin.entities.user')}
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
