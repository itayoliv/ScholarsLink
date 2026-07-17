import { useTranslation } from 'react-i18next';

export default function AdminDataTable({ columns, records, loading, onEdit, onDelete }) {
  const { t } = useTranslation();

  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="muted">
                {loading ? t('common.loading') : t('admin.noRecords')}
              </td>
            </tr>
          ) : (
            records.map((record) => (
              <tr key={record.id}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render ? column.render(record) : String(record[column.key] ?? '')}
                  </td>
                ))}
                <td>
                  <div className="row-actions">
                    <button type="button" className="small secondary" onClick={() => onEdit(record)}>
                      {t('common.edit')}
                    </button>
                    <button type="button" className="small danger" onClick={() => onDelete(record)}>
                      {t('common.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
