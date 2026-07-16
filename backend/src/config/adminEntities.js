export const adminEntities = {
  users: {
    table: 'User',
    readOnly: new Set(['id', 'createdAt', 'updatedAt']),
    sensitive: new Set(['password']),
  },
  placements: {
    table: 'Placement',
    readOnly: new Set(['id', 'createdAt', 'updatedAt']),
    sensitive: new Set(),
  },
  'join-requests': {
    table: 'JoinRequest',
    readOnly: new Set(['id', 'createdAt', 'updatedAt', 'reviewedAt']),
    sensitive: new Set(),
  },
  'hour-logs': {
    table: 'HourLog',
    readOnly: new Set(['id', 'createdAt', 'updatedAt', 'reviewedAt']),
    sensitive: new Set(),
  },
  memberships: {
    table: 'PlacementMembership',
    readOnly: new Set(['id']),
    sensitive: new Set(),
  },
  'form-options': {
    table: 'FormOption',
    readOnly: new Set(['id']),
    sensitive: new Set(),
  },
};
