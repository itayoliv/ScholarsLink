export function stripPassword(user) {
  if (!user) {
    return user;
  }

  const { password, ...safeUser } = user;
  return safeUser;
}

export function stripPasswordDeep(value) {
  if (Array.isArray(value)) {
    return value.map(stripPasswordDeep);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Keep Date, Prisma.Decimal, Buffer, etc. intact for JSON serialization.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return value;
  }

  const next = {};

  for (const [key, nested] of Object.entries(value)) {
    if (key === 'password') {
      continue;
    }

    next[key] = stripPasswordDeep(nested);
  }

  return next;
}

export function stripSensitiveColumns(row, config) {
  if (!row) {
    return row;
  }

  const next = {};

  for (const [key, value] of Object.entries(row)) {
    if (config.sensitive.has(key)) {
      continue;
    }

    if (typeof value === 'bigint') {
      next[key] = Number(value);
    } else {
      next[key] = value;
    }
  }

  return next;
}
