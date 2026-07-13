export default function AdminDataTable({ columns, records, loading, onEdit, onDelete }) {
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="muted">
                {loading ? 'Loading...' : 'No records found.'}
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
                      Edit
                    </button>
                    <button type="button" className="small danger" onClick={() => onDelete(record)}>
                      Delete
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
