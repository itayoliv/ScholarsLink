import { apiRequest } from '../../api';
import AdminEntityPage from '../../components/AdminEntityPage';

const fieldKeyOptions = [
  { value: 'gender', label: 'Gender' },
  { value: 'maritalStatus', label: 'Marital status' },
  { value: 'spouseStatus', label: 'Spouse status' },
  { value: 'militaryService', label: 'Military / national service' },
  { value: 'academicInstitutionName', label: 'Academic institution' },
  { value: 'yearOfStudy', label: 'Year of study' },
  { value: 'fieldOfStudy', label: 'Field of study' },
];

const activeOptions = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const columns = [
  { key: 'id', label: 'ID' },
  {
    key: 'fieldKey',
    label: 'Field',
    filter: { type: 'select', options: fieldKeyOptions },
    render: (record) => fieldKeyOptions.find((item) => item.value === record.fieldKey)?.label || record.fieldKey,
  },
  { key: 'value', label: 'Value', filter: { type: 'text' } },
  { key: 'label', label: 'Label', filter: { type: 'text' } },
  { key: 'sortOrder', label: 'Order' },
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
];

function getFields() {
  return [
    {
      name: 'fieldKey',
      label: 'Field key',
      type: 'select',
      options: fieldKeyOptions,
      placeholder: 'Select field',
      required: true,
    },
    { name: 'value', label: 'Value', type: 'text', required: true, hint: 'Stable machine value (do not translate).' },
    { name: 'label', label: 'Label', type: 'text', required: true, hint: 'Visible text (can later be Hebrew).' },
    { name: 'sortOrder', label: 'Sort order', type: 'number', min: '0', step: '1' },
    { name: 'active', label: 'Active', type: 'checkbox' },
  ];
}

export default function AdminFormOptionsPage() {
  return (
    <AdminEntityPage
      title="Form options"
      subtitle="Edit dropdown values used by the Scholars Registration form. Labels can be changed later for Hebrew."
      entity="form-options"
      entityLabel="Form option"
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
