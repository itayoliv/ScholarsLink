import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

function FieldInput({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <select
        value={value ?? ''}
        onChange={(event) => onChange(field.name, event.target.value)}
        required={field.required}
      >
        {field.placeholder !== undefined ? <option value="">{field.placeholder}</option> : null}
        {(field.options || []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value ?? ''}
        onChange={(event) => onChange(field.name, event.target.value)}
        placeholder={field.placeholder}
        required={field.required}
      />
    );
  }

  if (field.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => onChange(field.name, event.target.checked)}
      />
    );
  }

  return (
    <input
      type={field.type || 'text'}
      value={value ?? ''}
      onChange={(event) => onChange(field.name, event.target.value)}
      placeholder={field.placeholder}
      required={field.required}
      minLength={field.minLength}
      min={field.min}
      step={field.step}
    />
  );
}

export default function AdminRecordForm({ title, fields, initialValues, submitLabel, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [values, setValues] = useState(initialValues);
  const resolvedFields = useMemo(
    () => (typeof fields === 'function' ? fields(values) : fields),
    [fields, values],
  );

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function visibleValues() {
    return resolvedFields.reduce((payload, field) => {
      payload[field.name] = values[field.name];
      return payload;
    }, {});
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-panel panel" onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(visibleValues());
          }}
        >
          {resolvedFields.map((field) => (
            <label className="form-field" key={field.name}>
              <span>
                {field.label}
                {field.required ? ' *' : ''}
              </span>
              <FieldInput field={field} value={values[field.name]} onChange={setField} />
              {field.hint ? <small className="muted">{field.hint}</small> : null}
            </label>
          ))}
          <div className="actions form-actions">
            <button type="button" className="secondary" onClick={onCancel}>
              {t('common.cancel')}
            </button>
            <button type="submit">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
