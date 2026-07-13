export default function AdminFieldPicker({
  columns,
  selected,
  onToggle,
  roleOptions,
  activeRole,
  onRoleChange,
}) {
  if (!columns.length) {
    return null;
  }

  return (
    <section className="field-picker">
      <div className="field-picker-header">
        <div>
          <strong>Form fields</strong>
          <p className="muted">Choose which schema columns appear in the add/edit form.</p>
        </div>

        {roleOptions?.length ? (
          <div className="field-picker-roles" aria-label="User role form fields">
            {roleOptions.map((role) => (
              <button
                type="button"
                className={`small secondary${activeRole === role.value ? ' active' : ''}`}
                key={role.value}
                onClick={() => onRoleChange(role.value)}
              >
                {role.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="field-picker-grid">
        {columns.map((column) => (
          <label key={column.name} className="field-picker-option">
            <input
              type="checkbox"
              checked={selected.includes(column.name)}
              onChange={() => onToggle(column.name)}
            />
            <span>{column.label}</span>
            <small className="muted">{column.dataType}</small>
          </label>
        ))}
      </div>
    </section>
  );
}
