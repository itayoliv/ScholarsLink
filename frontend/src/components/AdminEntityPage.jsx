import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api';
import Layout from './Layout';
import AdminNav from './AdminNav';
import AdminDataTable from './AdminDataTable';
import AdminFieldPicker from './AdminFieldPicker';
import AdminRecordForm from './AdminRecordForm';

function labelize(value) {
  return String(value)
    .replace(/Id$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function enumOptions(columnType) {
  return Array.from(String(columnType || '').matchAll(/'([^']*)'/g)).map((match) => ({
    value: match[1],
    label: labelize(match[1].toLowerCase()),
  }));
}

function formatInputValue(value, column) {
  if (value === null || value === undefined) {
    return column.dataType === 'tinyint' && String(column.columnType).startsWith('tinyint(1)') ? false : '';
  }

  if (['date'].includes(column.dataType)) {
    return String(value).slice(0, 10);
  }

  if (['datetime', 'timestamp'].includes(column.dataType)) {
    return String(value).slice(0, 16);
  }

  return value;
}

function formatCellValue(value, column) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (column.dataType === 'tinyint' && String(column.columnType).startsWith('tinyint(1)')) {
    return value ? 'Yes' : 'No';
  }

  if (['date', 'datetime', 'timestamp'].includes(column.dataType)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }

  return String(value);
}

function fieldFromColumn(column) {
  const options = column.dataType === 'enum' ? enumOptions(column.columnType) : null;
  const isBoolean = column.dataType === 'tinyint' && String(column.columnType).startsWith('tinyint(1)');
  const isNumber = ['int', 'bigint', 'smallint', 'mediumint', 'tinyint', 'decimal', 'float', 'double'].includes(column.dataType);

  if (options?.length) {
    return {
      name: column.name,
      label: labelize(column.name),
      type: 'select',
      options,
      placeholder: column.nullable ? 'No value' : undefined,
      required: !column.nullable && column.defaultValue === null,
    };
  }

  if (isBoolean) {
    return { name: column.name, label: labelize(column.name), type: 'checkbox' };
  }

  if (['date'].includes(column.dataType)) {
    return { name: column.name, label: labelize(column.name), type: 'date', required: !column.nullable && column.defaultValue === null };
  }

  if (['datetime', 'timestamp'].includes(column.dataType)) {
    return { name: column.name, label: labelize(column.name), type: 'datetime-local', required: !column.nullable && column.defaultValue === null };
  }

  if (isNumber) {
    return { name: column.name, label: labelize(column.name), type: 'number', step: column.dataType === 'decimal' ? '0.01' : '1', required: !column.nullable && column.defaultValue === null };
  }

  return {
    name: column.name,
    label: labelize(column.name),
    type: ['text', 'mediumtext', 'longtext'].includes(column.dataType) ? 'textarea' : 'text',
    required: !column.nullable && column.defaultValue === null,
  };
}

export default function AdminEntityPage({
  entity,
  title,
  subtitle,
  entityLabel,
  loadRecords,
  columns,
  getFields,
  initialValues,
  onCreate,
  onUpdate,
  onDelete,
  fieldPickerRoles,
}) {
  const [records, setRecords] = useState([]);
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schemaLoading, setSchemaLoading] = useState(Boolean(entity));
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({});
  const [editing, setEditing] = useState(null);
  const [pickerRole, setPickerRole] = useState(fieldPickerRoles?.[0]?.value || 'default');
  const [, setSelectionVersion] = useState(0);

  const schemaColumns = schema?.columns || [];
  const visibleSchemaColumns = schemaColumns.filter((column) => !column.sensitive);
  const writableSchemaColumns = visibleSchemaColumns.filter((column) => !column.readOnly);

  const baseFieldNames = useMemo(() => {
    const names = new Set();

    for (const mode of ['create', 'edit']) {
      try {
        (getFields(mode, null) || []).forEach((field) => names.add(field.name));
      } catch {
        // Relation options may not be ready yet; fields will be recalculated when rendered.
      }
    }

    return names;
  }, [getFields]);

  const selectableFormColumns = useMemo(
    () => writableSchemaColumns
      .filter((column) => !baseFieldNames.has(column.name))
      .map((column) => ({ ...column, label: labelize(column.name) })),
    [writableSchemaColumns, baseFieldNames],
  );

  function storageKey(context) {
    return `scholarslink.admin.formFields.${entity}.${context}`;
  }

  function defaultSelection() {
    return selectableFormColumns.map((column) => column.name);
  }

  function selectedFields(context) {
    if (!entity || !selectableFormColumns.length) {
      return [];
    }

    try {
      const raw = localStorage.getItem(storageKey(context));
      return raw ? JSON.parse(raw) : defaultSelection();
    } catch {
      return defaultSelection();
    }
  }

  function toggleField(columnName) {
    const context = fieldPickerRoles ? pickerRole : 'default';
    const current = selectedFields(context);
    const next = current.includes(columnName)
      ? current.filter((name) => name !== columnName)
      : [...current, columnName];

    localStorage.setItem(storageKey(context), JSON.stringify(next));
    setSelectionVersion((version) => version + 1);
  }

  async function loadSchema() {
    if (!entity) {
      return;
    }

    setSchemaLoading(true);

    try {
      setSchema(await apiRequest(`/admin/schema/${entity}`));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSchemaLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);

    try {
      setRecords(await loadRecords());
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    loadSchema();
  }, []);

  const tableColumns = useMemo(() => {
    const configuredKeys = new Set(columns.map((column) => column.key));
    const dynamicColumns = visibleSchemaColumns
      .filter((column) => !configuredKeys.has(column.name))
      .map((column) => ({
        key: column.name,
        label: labelize(column.name),
        filter: column.dataType === 'enum'
          ? { type: 'select', options: enumOptions(column.columnType) }
          : { type: 'text', getValue: (record) => formatCellValue(record[column.name], column) },
        render: (record) => formatCellValue(record[column.name], column),
      }));

    return [...columns, ...dynamicColumns];
  }, [columns, visibleSchemaColumns]);

  const filterableColumns = tableColumns.filter((column) => column.filter);

  const filteredRecords = useMemo(
    () => records.filter((record) => filterableColumns.every((column) => {
      const raw = filters[column.key];

      if (raw === undefined || raw === '') {
        return true;
      }

      const getValue = column.filter.getValue || ((item) => item[column.key]);
      const target = String(getValue(record) ?? '').toLowerCase();

      if (column.filter.type === 'select') {
        return target === String(raw).toLowerCase();
      }

      return target.includes(String(raw).toLowerCase());
    })),
    [records, filters, filterableColumns],
  );

  async function handleSubmit(values) {
    try {
      if (editing.mode === 'edit') {
        await onUpdate(editing.record, values);
        setMessage(`${entityLabel} updated.`);
      } else {
        await onCreate(values);
        setMessage(`${entityLabel} created.`);
      }

      setEditing(null);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDelete(record) {
    if (!window.confirm(`Delete this ${entityLabel.toLowerCase()} (#${record.id})? This cannot be undone.`)) {
      return;
    }

    try {
      await onDelete(record);
      setMessage(`${entityLabel} deleted.`);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshSchema() {
    setSchemaLoading(true);

    try {
      const data = await apiRequest('/admin/schema/refresh', { method: 'POST' });
      const nextSchema = data.entities?.find((item) => item.entity === entity);

      if (nextSchema) {
        setSchema(nextSchema);
      } else {
        await loadSchema();
      }

      await refresh();
      setMessage(data.warning
        ? `Schema refreshed from the database. ${data.warning}`
        : 'Schema refreshed from the database.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSchemaLoading(false);
    }
  }

  function formContext(values = {}) {
    return fieldPickerRoles ? values.role || pickerRole : 'default';
  }

  function dynamicFields(values) {
    const selected = selectedFields(formContext(values));
    return selectableFormColumns
      .filter((column) => selected.includes(column.name))
      .map(fieldFromColumn);
  }

  function fieldsFor(mode, record) {
    return (values) => [...getFields(mode, record), ...dynamicFields(values)];
  }

  function valuesFor(record) {
    const values = { ...initialValues(record) };

    for (const column of writableSchemaColumns) {
      if (values[column.name] === undefined) {
        values[column.name] = record ? formatInputValue(record[column.name], column) : formatInputValue(undefined, column);
      }
    }

    return values;
  }

  return (
    <Layout title={title} subtitle={subtitle}>
      <AdminNav />

      {message ? <p className="status">{message}</p> : null}

      <section className="panel">
        <div className="admin-toolbar">
          <div className="admin-filters">
            {filterableColumns.map((column) => (
              column.filter.type === 'select' ? (
                <select
                  key={column.key}
                  value={filters[column.key] ?? ''}
                  onChange={(event) => setFilters({ ...filters, [column.key]: event.target.value })}
                >
                  <option value="">All: {column.label.toLowerCase()}</option>
                  {(column.filter.options || []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  key={column.key}
                  placeholder={`Filter by ${column.label.toLowerCase()}`}
                  value={filters[column.key] ?? ''}
                  onChange={(event) => setFilters({ ...filters, [column.key]: event.target.value })}
                />
              )
            ))}
            {filterableColumns.length > 0 ? (
              <button type="button" className="secondary small" onClick={() => setFilters({})}>
                Clear filters
              </button>
            ) : null}
          </div>

          <div className="admin-toolbar-actions">
            {entity ? (
              <button type="button" className="secondary" onClick={refreshSchema} disabled={schemaLoading}>
                {schemaLoading ? 'Refreshing schema...' : 'Refresh schema'}
              </button>
            ) : null}
            <button type="button" className="secondary" onClick={refresh} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button type="button" onClick={() => setEditing({ mode: 'create' })}>
              Add {entityLabel.toLowerCase()}
            </button>
          </div>
        </div>

        <p className="muted admin-count">
          {loading ? 'Loading records...' : `Showing ${filteredRecords.length} of ${records.length} records`}
        </p>

        <AdminFieldPicker
          columns={selectableFormColumns}
          selected={selectedFields(fieldPickerRoles ? pickerRole : 'default')}
          onToggle={toggleField}
          roleOptions={fieldPickerRoles}
          activeRole={pickerRole}
          onRoleChange={setPickerRole}
        />

        <AdminDataTable
          columns={tableColumns}
          records={filteredRecords}
          loading={loading}
          onEdit={(record) => setEditing({ mode: 'edit', record })}
          onDelete={handleDelete}
        />
      </section>

      {editing ? (
        <AdminRecordForm
          key={editing.mode === 'edit' ? `edit-${editing.record.id}` : 'create'}
          title={editing.mode === 'edit'
            ? `Edit ${entityLabel.toLowerCase()} #${editing.record.id}`
            : `Add ${entityLabel.toLowerCase()}`}
          fields={fieldsFor(editing.mode, editing.record)}
          initialValues={valuesFor(editing.record)}
          submitLabel={editing.mode === 'edit' ? 'Save changes' : 'Create'}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
        />
      ) : null}
    </Layout>
  );
}
