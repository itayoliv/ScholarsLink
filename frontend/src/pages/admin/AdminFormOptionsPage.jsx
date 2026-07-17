import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';

const fieldKeys = [
  'gender',
  'maritalStatus',
  'spouseStatus',
  'militaryService',
  'academicInstitutionName',
  'yearOfStudy',
  'fieldOfStudy',
];

export default function AdminFormOptionsPage() {
  const { t } = useTranslation();

  const fieldKeyOptions = useMemo(
    () => fieldKeys.map((key) => ({ value: key, label: t(`admin.formOptions.keys.${key}`) })),
    [t],
  );

  const activeOptions = useMemo(() => [
    { value: 'true', label: t('common.active') },
    { value: 'false', label: t('common.inactive') },
  ], [t]);

  const columns = useMemo(() => [
    { key: 'id', label: t('common.id') },
    {
      key: 'fieldKey',
      label: t('admin.formOptions.field'),
      filter: { type: 'select', options: fieldKeyOptions },
      render: (record) => fieldKeyOptions.find((item) => item.value === record.fieldKey)?.label || record.fieldKey,
    },
    { key: 'value', label: t('admin.formOptions.value'), filter: { type: 'text' } },
    { key: 'label', label: t('admin.formOptions.label'), filter: { type: 'text' } },
    { key: 'sortOrder', label: t('admin.formOptions.order') },
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
  ], [t, fieldKeyOptions, activeOptions]);

  function getFields() {
    return [
      {
        name: 'fieldKey',
        label: t('admin.formOptions.fieldKey'),
        type: 'select',
        options: fieldKeyOptions,
        placeholder: t('admin.formOptions.selectField'),
        required: true,
      },
      { name: 'value', label: t('admin.formOptions.value'), type: 'text', required: true, hint: t('admin.formOptions.valueHint') },
      { name: 'label', label: t('admin.formOptions.label'), type: 'text', required: true, hint: t('admin.formOptions.labelHint') },
      { name: 'sortOrder', label: t('admin.formOptions.sortOrder'), type: 'number', min: '0', step: '1' },
      { name: 'active', label: t('common.active'), type: 'checkbox' },
    ];
  }

  return (
    <AdminEntityPage
      title={t('admin.formOptions.title')}
      subtitle={t('admin.formOptions.subtitle')}
      entity="form-options"
      entityLabel={t('admin.entities.formOption')}
      loadRecords={() => apiRequest('/form-options')}
      columns={columns}
      getFields={getFields}
      initialValues={(record) => (record
        ? {
            fieldKey: record.fieldKey,
            value: record.value,
            label: record.label,
            sortOrder: String(record.sortOrder ?? 0),
            active: record.active,
          }
        : {
            fieldKey: 'gender',
            value: '',
            label: '',
            sortOrder: '0',
            active: true,
          })}
      onCreate={(values) => apiRequest('/form-options', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          sortOrder: Number(values.sortOrder) || 0,
          active: Boolean(values.active),
        }),
      })}
      onUpdate={(record, values) => apiRequest(`/form-options/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...values,
          sortOrder: Number(values.sortOrder) || 0,
          active: Boolean(values.active),
        }),
      })}
      onDelete={(record) => apiRequest(`/form-options/${record.id}`, { method: 'DELETE' })}
    />
  );
}
