export function parseId(value, fieldName) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`${fieldName} must be a positive integer.`);
    error.status = 400;
    throw error;
  }

  return id;
}

export function parseOptionalId(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return parseId(value, fieldName);
}

export function parseOptionalDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const error = new Error('date must be valid.');
    error.status = 400;
    throw error;
  }

  return date;
}
